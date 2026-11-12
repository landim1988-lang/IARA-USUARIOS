import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";
import { pool } from "@/lib/access-control";

const masterEmail = "usuarios@credipi.com.br";

function tokenMatches(candidate: string, configured: string) {
  const candidateBytes = Buffer.from(candidate);
  const configuredBytes = Buffer.from(configured);
  return candidateBytes.length === configuredBytes.length && timingSafeEqual(candidateBytes, configuredBytes);
}

export async function GET() {
  if (!process.env.MASTER_SETUP_TOKEN) return NextResponse.json({ available: false });
  const result = await pool.query('select 1 from public."user" where role = \'master\' limit 1');
  return NextResponse.json({ available: !result.rows[0] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: string; name?: string; email?: string; password?: string } | null;
  const configuredToken = process.env.MASTER_SETUP_TOKEN;
  if (!configuredToken || typeof body?.token !== "string" || !tokenMatches(body.token, configuredToken)) {
    return NextResponse.json({ error: "Token de configuração inválido." }, { status: 401 });
  }
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  if (email !== masterEmail || name.length < 2 || name.length > 120 || typeof body.password !== "string" || body.password.length < 12 || body.password.length > 200) {
    return NextResponse.json({ error: "Informe o nome e defina uma senha nova com pelo menos 12 caracteres para a conta Master." }, { status: 400 });
  }

  const existingMaster = await pool.query('select 1 from public."user" where role = \'master\' limit 1');
  if (existingMaster.rows[0]) return NextResponse.json({ error: "A conta Master inicial já foi configurada." }, { status: 409 });

  try {
    const existingUser = await pool.query('select id from public."user" where lower(email) = $1 limit 1', [masterEmail]);
    let userId: string;
    if (existingUser.rows[0]) {
      userId = existingUser.rows[0].id;
    } else {
      const created = await auth.api.signUpEmail({
        body: { name, email: masterEmail, password: body.password },
        headers: request.headers,
      });
      userId = created.user.id;
    }
    await pool.query('update public."user" set role = \'master\', store_id = null where id = $1', [userId]);
    return NextResponse.json({ ok: true, email: masterEmail }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível criar a conta Master. Verifique se o e-mail ainda não está cadastrado e tente novamente." }, { status: 400 });
  }
}
