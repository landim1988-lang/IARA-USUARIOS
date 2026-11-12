import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentUser, pool } from "@/lib/access-control";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function masterOnly() {
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  if (user.role !== "master") return { user: null, response: NextResponse.json({ error: "Somente o usuário Master pode gerenciar usuários." }, { status: 403 }) };
  return { user, response: null };
}

export async function GET() {
  const { response } = await masterOnly();
  if (response) return response;
  const result = await pool.query(
    'select u.id, u.name, u.email, u.role, u.store_id, s.name as store_name from public."user" u left join stores s on s.id = u.store_id order by u.role desc, u.name asc',
  );
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const { response } = await masterOnly();
  if (response) return response;
  const body = await request.json().catch(() => null) as { name?: string; email?: string; password?: string; store_id?: string } | null;
  const name = body?.name?.trim() ?? "";
  const email = body?.email?.trim().toLowerCase() ?? "";
  if (name.length < 2 || name.length > 120 || !emailPattern.test(email) || typeof body?.password !== "string" || body.password.length < 12 || body.password.length > 200 || !body.store_id || !uuidPattern.test(body.store_id)) {
    return NextResponse.json({ error: "Informe nome, e-mail, senha com no mínimo 12 caracteres e loja válida." }, { status: 400 });
  }
  const store = await pool.query("select id from stores where id = $1", [body.store_id]);
  if (!store.rows[0]) return NextResponse.json({ error: "A loja selecionada não existe." }, { status: 400 });

  try {
    const created = await auth.api.signUpEmail({
      body: { name, email, password: body.password },
      headers: request.headers,
    });
    const result = await pool.query(
      'update public."user" set role = \'admin\', store_id = $1 where id = $2 returning id, name, email, role, store_id',
      [body.store_id, created.user.id],
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : "";
    const duplicate = code === "23505" || /already exists|already been used|unique/i.test(message);
    return NextResponse.json({ error: duplicate ? "Já existe uma conta com esse e-mail." : "Não foi possível criar a conta. Verifique os dados e tente novamente." }, { status: duplicate ? 409 : 400 });
  }
}

export async function PATCH(request: Request) {
  const { response } = await masterOnly();
  if (response) return response;
  const body = await request.json().catch(() => null) as { id?: string; store_id?: string | null } | null;
  if (!body?.id || !(body.store_id === null || typeof body.store_id === "string" && uuidPattern.test(body.store_id))) {
    return NextResponse.json({ error: "Usuário ou loja inválida." }, { status: 400 });
  }
  if (body.store_id) {
    const store = await pool.query("select id from stores where id = $1", [body.store_id]);
    if (!store.rows[0]) return NextResponse.json({ error: "A loja selecionada não existe." }, { status: 400 });
  }
  const result = await pool.query(
    'update public."user" u set store_id = $1 from (select id, role from public."user" where id = $2) target where u.id = target.id and target.role = \'admin\' returning u.id, u.name, u.email, u.role, u.store_id',
    [body.store_id, body.id],
  );
  if (!result.rows[0]) return NextResponse.json({ error: "Conta não encontrada ou conta Master protegida." }, { status: 404 });
  return NextResponse.json(result.rows[0]);
}
