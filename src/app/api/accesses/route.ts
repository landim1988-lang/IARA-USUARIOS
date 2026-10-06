import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const key = Buffer.from((process.env.BETTER_AUTH_SECRET ?? "").padEnd(32, "0").slice(0, 32));

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function decrypt(value: string) {
  const [iv, tag, content] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(content, "base64url")), decipher.final()]).toString("utf8");
}
async function user() { const session = await auth.api.getSession({ headers: await headers() }); return session?.user ?? null; }

export async function GET(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  const result = id
    ? await pool.query("select a.id,a.bank_id,a.login,a.cpf_titular,a.status,a.notes,a.created_at,a.updated_at,a.password_changed_at,a.password_expires_at,b.id as bank_id_ref,b.name as bank_name,b.color as bank_color,b.logo_url,b.portal_url from accesses a join banks b on b.id=a.bank_id where a.id=$1", [id])
    : await pool.query("select a.id,a.bank_id,a.login,a.cpf_titular,a.status,a.notes,a.created_at,a.updated_at,a.password_changed_at,a.password_expires_at,b.id as bank_id_ref,b.name as bank_name,b.color as bank_color,b.logo_url,b.portal_url from accesses a join banks b on b.id=a.bank_id order by a.updated_at desc");
  const accessIds = result.rows.map((row) => row.id);
  if (accessIds.length) {
    const teams = await pool.query("select at.access_id,at.team_id,t.id,t.name from access_teams at join teams t on t.id=at.team_id where at.access_id = any($1::uuid[]) order by t.name", [accessIds]);
    const byAccess = new Map<string, { team_id: string; teams: { id: string; name: string } }[]>();
    for (const team of teams.rows) {
      const links = byAccess.get(team.access_id) ?? [];
      links.push({ team_id: team.team_id, teams: { id: team.id, name: team.name } });
      byAccess.set(team.access_id, links);
    }
    for (const row of result.rows) row.access_teams = byAccess.get(row.id) ?? [];
  }
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; bank_id?: string; login?: string; status?: string; notes?: string | null; cpf_titular?: string | null; password?: string; password_expires_at?: string | null } | null;
  if (!body?.bank_id || !body.login?.trim() || !["active", "blocked", "canceled"].includes(body.status ?? "")) return NextResponse.json({ error: "Informe banco, login e status válido." }, { status: 400 });
  if (body.login.trim().length > 160 || (body.cpf_titular?.trim().length ?? 0) > 14 || (body.notes?.trim().length ?? 0) > 2000) return NextResponse.json({ error: "Um dos campos ultrapassa o limite permitido." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const password = typeof body.password === "string" && body.password.length > 0 ? body.password : undefined;
    const duplicate = await client.query("select id from accesses where bank_id=$1 and lower(trim(login))=lower(trim($2)) and ($3::uuid is null or id <> $3::uuid) limit 1", [body.bank_id, body.login.trim(), body.id ?? null]);
    if (duplicate.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "Este login já está cadastrado neste banco." }, { status: 409 });
    }
    const result = body.id
      ? await client.query("update accesses set bank_id=$1,login=$2,cpf_titular=nullif($3,''),status=$4,notes=$5,password_encrypted=coalesce($6,password_encrypted),password_changed_at=case when $6::text is null then password_changed_at else now() end,password_expires_at=$7::timestamptz,updated_at=now() where id=$8 returning id", [body.bank_id, body.login.trim(), body.cpf_titular?.trim() || "", body.status, body.notes?.trim() || null, password ? encrypt(password) : null, body.password_expires_at || null, body.id])
      : await client.query("insert into accesses (bank_id,login,cpf_titular,status,notes,password_encrypted,password_changed_at,password_expires_at) values ($1,$2,nullif($3,''),$4,$5,$6,case when $6::text is null then null else now() end,$7::timestamptz) returning id", [body.bank_id, body.login.trim(), body.cpf_titular?.trim() || "", body.status, body.notes?.trim() || null, password ? encrypt(password) : null, body.password_expires_at || null]);
    if (!result.rows[0]) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
    const accessId = result.rows[0].id;
    await client.query("commit");
    return NextResponse.json({ id: accessId });
  } catch (caughtError: unknown) {
    await client.query("rollback").catch(() => undefined);
    const code: string | undefined = (caughtError as { code?: string }).code;
    const message = (caughtError as { message?: string }).message ?? "";
    const isSchemaError = code === "42703" || code === "42P01" || code === "42704";
    const error = code === "23505" ? "Este login já está cadastrado neste banco." : code === "23503" ? "O banco selecionado não existe mais. Atualize a página e selecione o banco novamente." : isSchemaError ? "A estrutura do banco está desatualizada. Atualize a migração e tente novamente." : message.includes("invalid input syntax for type uuid") ? "O banco selecionado é inválido. Recarregue a página e tente novamente." : "Não foi possível salvar o acesso. Verifique banco, login e senha e tente novamente.";
    return NextResponse.json({ error }, { status: code === "23505" ? 409 : 500 });
  } finally { client.release(); }
}

export async function PATCH(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; password_expires_at?: string | null } | null;
  if (!body?.id) return NextResponse.json({ error: "Acesso inválido." }, { status: 400 });
  if (Object.prototype.hasOwnProperty.call(body, "password_expires_at")) {
    const result = await pool.query("update accesses set password_expires_at=$1::timestamptz,updated_at=now() where id=$2 returning id", [body.password_expires_at || null, body.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
    return NextResponse.json({ id: body.id, password_expires_at: body.password_expires_at || null });
  }
  const result = await pool.query("select password_encrypted from accesses where id=$1", [body.id]);
  if (!result.rows[0]?.password_encrypted) return NextResponse.json({ error: "Senha não cadastrada." }, { status: 404 });
  try {
    const password = decrypt(result.rows[0].password_encrypted);
    const sessionUser = await user();
    await pool.query("insert into audit_log (user_id, action, entity_type, entity_id, details) values ($1, $2, $3, $4, $5::jsonb)", [sessionUser?.id, "reveal_password", "access", body.id, JSON.stringify({ channel: "access-detail" })]);
    return NextResponse.json({ password });
  } catch { return NextResponse.json({ error: "Senha indisponível." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Acesso inválido." }, { status: 400 });
  await pool.query("delete from accesses where id=$1", [body.id]);
  return new NextResponse(null, { status: 204 });
}
