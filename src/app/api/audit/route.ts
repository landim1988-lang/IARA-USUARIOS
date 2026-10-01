import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const result = await pool.query(
    "select id, action, entity_type, entity_id, details, created_at from audit_log where user_id = $1 order by created_at desc limit 100",
    [session.user.id],
  );
  return NextResponse.json({ items: result.rows });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (typeof body.action !== "string" || typeof body.entity_type !== "string") {
    return NextResponse.json({ error: "Ação e tipo de entidade são obrigatórios." }, { status: 400 });
  }
  await pool.query(
    "insert into audit_log (user_id, action, entity_type, entity_id, details) values ($1, $2, $3, $4, $5::jsonb)",
    [session.user.id, body.action.trim().slice(0, 80), body.entity_type.trim().slice(0, 80), typeof body.entity_id === "string" ? body.entity_id : null, JSON.stringify(body.details ?? {})],
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
