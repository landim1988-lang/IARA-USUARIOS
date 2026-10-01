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
    ? await pool.query("select a.id,a.bank_id,a.login,a.status,a.notes,a.created_at,a.updated_at,a.password_changed_at,b.id as bank_id_ref,b.name as bank_name,b.color as bank_color,b.logo_url,b.portal_url from accesses a join banks b on b.id=a.bank_id where a.id=$1", [id])
    : await pool.query("select a.id,a.bank_id,a.login,a.status,a.notes,a.created_at,a.updated_at,a.password_changed_at,b.id as bank_id_ref,b.name as bank_name,b.color as bank_color,b.logo_url,b.portal_url from accesses a join banks b on b.id=a.bank_id order by a.updated_at desc");
  if (id && result.rows[0]) {
    const teams = await pool.query("select at.team_id,t.id,t.name from access_teams at join teams t on t.id=at.team_id where at.access_id=$1 order by t.name", [id]);
    result.rows[0].access_teams = teams.rows.map((team) => ({ team_id: team.team_id, teams: { id: team.id, name: team.name } }));
  }
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; bank_id?: string; login?: string; status?: string; notes?: string | null; team_ids?: string[]; password?: string } | null;
  if (!body?.bank_id || !body.login?.trim() || !["active", "blocked", "canceled"].includes(body.status ?? "")) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const password = body.password?.trim();
    const result = body.id
      ? await client.query("update accesses set bank_id=$1,login=$2,status=$3,notes=$4,password_encrypted=coalesce($5,password_encrypted),password_changed_at=case when $5 is null then password_changed_at else now() end,updated_at=now() where id=$6 returning id", [body.bank_id, body.login.trim(), body.status, body.notes?.trim() || null, password ? encrypt(password) : null, body.id])
      : await client.query("insert into accesses (bank_id,login,status,notes,password_encrypted,password_changed_at) values ($1,$2,$3,$4,$5,case when $5 is null then null else now() end) returning id", [body.bank_id, body.login.trim(), body.status, body.notes?.trim() || null, password ? encrypt(password) : null]);
    if (!result.rows[0]) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
    const accessId = result.rows[0].id;
    await client.query("delete from access_teams where access_id=$1", [accessId]);
    for (const teamId of body.team_ids ?? []) await client.query("insert into access_teams (access_id,team_id) values ($1,$2)", [accessId, teamId]);
    await client.query("commit");
    return NextResponse.json({ id: accessId });
  } catch (error: unknown) { await client.query("rollback"); const code = (error as { code?: string }).code; return NextResponse.json({ error: code === "23505" ? "Este login já está cadastrado neste banco." : "Não foi possível salvar o acesso." }, { status: code === "23505" ? 409 : 500 }); } finally { client.release(); }
}

export async function PATCH(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Acesso inválido." }, { status: 400 });
  const result = await pool.query("select password_encrypted from accesses where id=$1", [body.id]);
  if (!result.rows[0]?.password_encrypted) return NextResponse.json({ error: "Senha não cadastrada." }, { status: 404 });
  try { return NextResponse.json({ password: decrypt(result.rows[0].password_encrypted) }); } catch { return NextResponse.json({ error: "Senha indisponível." }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  if (!(await user())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Acesso inválido." }, { status: 400 });
  await pool.query("delete from accesses where id=$1", [body.id]);
  return new NextResponse(null, { status: 204 });
}
