import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const allowedTables = new Set(["banks", "teams"]);

async function authorized() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const table = new URL(request.url).searchParams.get("table") ?? "";
  if (!allowedTables.has(table)) return NextResponse.json({ error: "Tabela inválida." }, { status: 400 });
  const result = await pool.query(`select * from ${table} order by name asc`);
  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { table?: string; id?: string; values?: Record<string, unknown> } | null;
  if (!body?.table || !allowedTables.has(body.table) || !body.values) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const values = Object.entries(body.values).filter(([key]) => !["id", "created_at", "updated_at"].includes(key));
  if (!values.length) return NextResponse.json({ error: "Nenhum dado informado." }, { status: 400 });
  const columns = values.map(([key]) => key);
  const params = values.map(([, value]) => value);
  if (body.id) {
    const set = columns.map((column, index) => `"${column}" = $${index + 1}`).join(", ");
    const result = await pool.query(`update ${body.table} set ${set}, updated_at = now() where id = $${params.length + 1} returning *`, [...params, body.id]);
    return NextResponse.json(result.rows[0]);
  }
  const result = await pool.query(`insert into ${body.table} (${columns.map((column) => `"${column}"`).join(",")}) values (${params.map((_, index) => `$${index + 1}`).join(",")}) returning *`, params);
  return NextResponse.json(result.rows[0], { status: 201 });
}

export async function DELETE(request: Request) {
  if (!(await authorized())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null) as { table?: string; id?: string } | null;
  if (!body?.table || !allowedTables.has(body.table) || !body.id) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  await pool.query(`delete from ${body.table} where id = $1`, [body.id]);
  return new NextResponse(null, { status: 204 });
}
