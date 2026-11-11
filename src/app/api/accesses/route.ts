import { NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getCurrentUser, pool, type UserContext } from "@/lib/access-control";

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

async function canAccess(id: string, user: UserContext) {
  if (user.role === "master") return true;
  if (!user.storeId) return false;
  const result = await pool.query("select 1 from access_stores where access_id = $1 and store_id = $2 limit 1", [id, user.storeId]);
  return Boolean(result.rows[0]);
}

async function loadAccesses(id: string | null, user: UserContext) {
  const values: string[] = [];
  let where = "";
  if (id) {
    values.push(id);
    where = "where a.id = $1";
  }
  if (user.role !== "master") {
    if (!user.storeId) return [];
    values.push(user.storeId);
    where += `${where ? " and" : "where"} exists (select 1 from access_stores scope where scope.access_id = a.id and scope.store_id = $${values.length})`;
  }
  const result = await pool.query(
    `select a.id,a.bank_id,a.login,a.cpf_titular,a.status,a.notes,a.created_at,a.updated_at,a.password_changed_at,a.password_expires_at,b.id as bank_id_ref,b.name as bank_name,b.color as bank_color,b.logo_url,b.portal_url from accesses a join banks b on b.id=a.bank_id ${where} order by a.updated_at desc`,
    values,
  );
  const accessIds = result.rows.map((row) => row.id);
  if (accessIds.length) {
    const links = user.role === "master"
      ? await pool.query("select ast.access_id, ast.store_id, s.id, s.name from access_stores ast join stores s on s.id = ast.store_id where ast.access_id = any($1::uuid[]) order by s.name", [accessIds])
      : await pool.query("select ast.access_id, ast.store_id, s.id, s.name from access_stores ast join stores s on s.id = ast.store_id where ast.access_id = any($1::uuid[]) and ast.store_id = $2 order by s.name", [accessIds, user.storeId]);
    const byAccess = new Map<string, { store_id: string; stores: { id: string; name: string } }[]>();
    for (const link of links.rows) {
      const stores = byAccess.get(link.access_id) ?? [];
      stores.push({ store_id: link.store_id, stores: { id: link.id, name: link.name } });
      byAccess.set(link.access_id, stores);
    }
    for (const row of result.rows) row.access_stores = byAccess.get(row.id) ?? [];
  }
  return result.rows;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  return NextResponse.json(await loadAccesses(id, user));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as {
    id?: string; bank_id?: string; login?: string; status?: string; notes?: string | null;
    cpf_titular?: string | null; password?: string; password_expires_at?: string | null; store_ids?: string[];
  } | null;
  if (!body?.bank_id || !body.login?.trim() || !["active", "blocked", "canceled"].includes(body.status ?? "")) {
    return NextResponse.json({ error: "Informe banco, login e status válido." }, { status: 400 });
  }
  if (body.login.trim().length > 160 || (body.cpf_titular?.trim().length ?? 0) > 14 || (body.notes?.trim().length ?? 0) > 2000) {
    return NextResponse.json({ error: "Um dos campos ultrapassa o limite permitido." }, { status: 400 });
  }
  if (body.id && !(await canAccess(body.id, user))) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  if (user.role !== "master" && !user.storeId) return NextResponse.json({ error: "Sua conta ainda não está vinculada a uma loja." }, { status: 403 });

  const client = await pool.connect();
  try {
    await client.query("begin");
    const password = typeof body.password === "string" && body.password.length > 0 ? body.password : undefined;
    const duplicate = await client.query(
      "select id from accesses where bank_id=$1 and lower(trim(login))=lower(trim($2)) and ($3::uuid is null or id <> $3::uuid) limit 1",
      [body.bank_id, body.login.trim(), body.id ?? null],
    );
    if (duplicate.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "Este login já está cadastrado neste banco." }, { status: 409 });
    }

    let storeIds: string[];
    if (user.role === "master") {
      if (body.store_ids !== undefined && (!Array.isArray(body.store_ids) || body.store_ids.some((id) => typeof id !== "string"))) {
        await client.query("rollback");
        return NextResponse.json({ error: "Lojas inválidas." }, { status: 400 });
      }
      if (body.store_ids !== undefined) storeIds = [...new Set(body.store_ids)];
      else if (body.id) {
        const current = await client.query("select store_id from access_stores where access_id = $1", [body.id]);
        storeIds = current.rows.map((row) => row.store_id as string);
      } else storeIds = [];
    } else if (body.id) {
      const current = await client.query("select store_id from access_stores where access_id = $1", [body.id]);
      storeIds = current.rows.map((row) => row.store_id as string);
    } else {
      storeIds = [user.storeId!];
    }

    if (!storeIds.length) {
      await client.query("rollback");
      return NextResponse.json({ error: "Vincule o acesso a pelo menos uma loja." }, { status: 400 });
    }

    if (storeIds.length) {
      const stores = await client.query("select id from stores where id = any($1::uuid[])", [storeIds]);
      if (stores.rows.length !== storeIds.length) {
        await client.query("rollback");
        return NextResponse.json({ error: "Uma das lojas selecionadas não existe." }, { status: 400 });
      }
    }

    const result = body.id
      ? await client.query(
          "update accesses set bank_id=$1,login=$2,cpf_titular=nullif($3,''),status=$4,notes=$5,password_encrypted=coalesce($6,password_encrypted),password_changed_at=case when $6::text is null then password_changed_at else now() end,password_expires_at=$7::timestamptz,updated_at=now() where id=$8 returning id",
          [body.bank_id, body.login.trim(), body.cpf_titular?.trim() || "", body.status, body.notes?.trim() || null, password ? encrypt(password) : null, body.password_expires_at || null, body.id],
        )
      : await client.query(
          "insert into accesses (bank_id,login,cpf_titular,status,notes,password_encrypted,password_changed_at,password_expires_at) values ($1,$2,nullif($3,''),$4,$5,$6,case when $6::text is null then null else now() end,$7::timestamptz) returning id",
          [body.bank_id, body.login.trim(), body.cpf_titular?.trim() || "", body.status, body.notes?.trim() || null, password ? encrypt(password) : null, body.password_expires_at || null],
        );
    if (!result.rows[0]) {
      await client.query("rollback");
      return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
    }
    const accessId = result.rows[0].id as string;
    if (user.role === "master" || !body.id) {
      await client.query("delete from access_stores where access_id = $1", [accessId]);
      if (storeIds.length) await client.query("insert into access_stores (access_id, store_id) select $1, unnest($2::uuid[])", [accessId, storeIds]);
    }
    await client.query("commit");
    return NextResponse.json({ id: accessId, store_ids: storeIds });
  } catch (caughtError: unknown) {
    await client.query("rollback").catch(() => undefined);
    const code = (caughtError as { code?: string }).code;
    const message = (caughtError as { message?: string }).message ?? "";
    const error = code === "23505" ? "Este login já está cadastrado neste banco." : code === "23503" ? "O banco ou a loja selecionada não existe mais." : message.includes("invalid input syntax for type uuid") ? "O banco ou a loja selecionada é inválido." : "Não foi possível salvar o acesso. Verifique banco, login e senha e tente novamente.";
    return NextResponse.json({ error }, { status: code === "23505" ? 409 : 500 });
  } finally {
    client.release();
  }
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string; password_expires_at?: string | null } | null;
  if (!body?.id) return NextResponse.json({ error: "Acesso inválido." }, { status: 400 });
  if (!(await canAccess(body.id, user))) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });

  if (Object.prototype.hasOwnProperty.call(body, "password_expires_at")) {
    const result = await pool.query("update accesses set password_expires_at=$1::timestamptz,updated_at=now() where id=$2 returning id", [body.password_expires_at || null, body.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
    return NextResponse.json({ id: body.id, password_expires_at: body.password_expires_at || null });
  }

  const result = await pool.query("select password_encrypted from accesses where id=$1", [body.id]);
  if (!result.rows[0]?.password_encrypted) return NextResponse.json({ error: "Senha não cadastrada." }, { status: 404 });
  try {
    const password = decrypt(result.rows[0].password_encrypted);
    await pool.query("insert into audit_log (user_id, action, entity_type, entity_id, details) values ($1, $2, $3, $4, $5::jsonb)", [user.id, "reveal_password", "access", body.id, JSON.stringify({ channel: "access-detail" })]);
    return NextResponse.json({ password });
  } catch {
    return NextResponse.json({ error: "Senha indisponível." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Acesso inválido." }, { status: 400 });
  if (!(await canAccess(body.id, user))) return NextResponse.json({ error: "Acesso não encontrado." }, { status: 404 });
  await pool.query("delete from accesses where id=$1", [body.id]);
  return new NextResponse(null, { status: 204 });
}
