import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Pool } from "pg";
import crypto from "node:crypto";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function currentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const result = await pool.query("select id, label, created_at from data_backups where user_id = $1 order by created_at desc limit 50", [user.id]);
  return NextResponse.json({ items: result.rows });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (!body.payload || typeof body.payload !== "object") return NextResponse.json({ error: "Payload de backup inválido." }, { status: 400 });
  const id = crypto.randomUUID();
  const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : `Backup ${new Date().toLocaleDateString("pt-BR")}`;
  await pool.query("insert into data_backups (id, user_id, label, payload) values ($1, $2, $3, $4::jsonb)", [id, user.id, label, JSON.stringify(body.payload)]);
  await pool.query("insert into audit_log (user_id, action, entity_type, entity_id, details) values ($1, $2, $3, $4, $5::jsonb)", [user.id, "create", "backup", id, JSON.stringify({ label })]);
  return NextResponse.json({ id, label }, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Backup não informado." }, { status: 400 });
  await pool.query("delete from data_backups where id = $1 and user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
