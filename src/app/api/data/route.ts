import { NextResponse } from "next/server";
import { getCurrentUser, pool } from "@/lib/access-control";

const allowedTables = {
  banks: ["name", "color", "logo_url", "portal_url", "is_active"],
  stores: ["name", "responsible", "notes"],
} as const;
type DataTable = keyof typeof allowedTables;

function isDataTable(value: string): value is DataTable {
  return Object.prototype.hasOwnProperty.call(allowedTables, value);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const table = new URL(request.url).searchParams.get("table") ?? "";
  if (!isDataTable(table)) return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });

  if (table === "stores" && user.role !== "master") {
    if (!user.storeId) return NextResponse.json([]);
    const result = await pool.query("select * from stores where id = $1 order by name asc", [user.storeId]);
    return NextResponse.json(result.rows);
  }

  const result = await pool.query(`select * from ${table} order by name asc`);
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null) as { table?: string; id?: string; values?: Record<string, unknown> } | null;
  if (!body?.table || !isDataTable(body.table) || !body.values || typeof body.values !== "object" || Array.isArray(body.values)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  if (user.role !== "master") {
    return NextResponse.json({ error: "Somente o usuário Master pode alterar cadastros globais." }, { status: 403 });
  }

  const allowedFields: readonly string[] = allowedTables[body.table];
  const values = Object.entries(body.values).filter(([key]) => allowedFields.includes(key));
  if (!values.length) return NextResponse.json({ error: "Nenhum dado válido informado." }, { status: 400 });
  if (body.table === "stores" && typeof body.values.name === "string" && body.values.name.trim().length < 2) {
    return NextResponse.json({ error: "Informe um nome de loja com pelo menos dois caracteres." }, { status: 400 });
  }

  const columns = values.map(([key]) => key);
  const params = values.map(([, value]) => typeof value === "string" ? value.trim() || null : value);
  try {
    if (body.id) {
      const set = columns.map((column, index) => `"${column}" = $${index + 1}`).join(", ");
      const result = await pool.query(`update ${body.table} set ${set}, updated_at = now() where id = $${params.length + 1} returning *`, [...params, body.id]);
      if (!result.rows[0]) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
      return NextResponse.json(result.rows[0]);
    }
    const result = await pool.query(
      `insert into ${body.table} (${columns.map((column) => `"${column}"`).join(",")}) values (${params.map((_, index) => `$${index + 1}`).join(",")}) returning *`,
      params,
    );
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    const code = (error as { code?: string }).code;
    return NextResponse.json({ error: code === "23505" ? "Já existe um registro com esse nome." : "Não foi possível salvar o cadastro." }, { status: code === "23505" ? 409 : 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null) as { table?: string; id?: string } | null;
  if (!body?.table || !isDataTable(body.table) || !body.id) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  if (user.role !== "master") {
    return NextResponse.json({ error: "Somente o usuário Master pode excluir cadastros globais." }, { status: 403 });
  }

  try {
    if (body.table === "stores") {
      const references = await pool.query(
        "select (select count(*) from access_stores where store_id = $1) + (select count(*) from public.\"user\" where store_id = $1) as count",
        [body.id],
      );
      if (Number(references.rows[0]?.count ?? 0) > 0) {
        return NextResponse.json({ error: "A loja ainda está vinculada a usuários ou acessos." }, { status: 409 });
      }
    }
    const result = await pool.query(`delete from ${body.table} where id = $1 returning id`, [body.id]);
    if (!result.rows[0]) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o cadastro." }, { status: 500 });
  }
}
