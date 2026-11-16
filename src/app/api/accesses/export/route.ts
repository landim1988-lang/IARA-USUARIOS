import { NextResponse } from "next/server";
import { decryptAccessPassword } from "@/lib/access-credentials";
import { getCurrentUser, pool } from "@/lib/access-control";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (user.role !== "master" && !user.storeId) return NextResponse.json({ error: "Sua conta ainda não está vinculada a uma loja." }, { status: 403 });

  const body = await request.json().catch(() => null) as { access_ids?: unknown } | null;
  if (!Array.isArray(body?.access_ids) || body.access_ids.length === 0 || body.access_ids.length > 5000 || body.access_ids.some((id) => typeof id !== "string" || !uuidPattern.test(id))) {
    return NextResponse.json({ error: "A lista de acessos para exportação é inválida." }, { status: 400 });
  }
  const accessIds = [...new Set(body.access_ids as string[])];

  try {
    const result = await pool.query(
      `select a.id,a.login,a.status,a.created_at,a.password_changed_at,a.password_encrypted,b.name as bank_name,
        coalesce(array_agg(distinct s.name order by s.name) filter (where s.name is not null), '{}'::text[]) as stores
       from accesses a
       join banks b on b.id = a.bank_id
       left join access_stores ast on ast.access_id = a.id and ($2::boolean or ast.store_id = $3::uuid)
       left join stores s on s.id = ast.store_id
       where a.id = any($1::uuid[])
         and ($2::boolean or exists (select 1 from access_stores scoped where scoped.access_id = a.id and scoped.store_id = $3::uuid))
       group by a.id,b.name
       order by array_position($1::uuid[], a.id)`,
      [accessIds, user.role === "master", user.storeId],
    );

    if (result.rows.length !== accessIds.length) return NextResponse.json({ error: "Um ou mais acessos não estão disponíveis para sua conta." }, { status: 404 });

    const rows = result.rows.map((row) => ({
      id: row.id as string,
      bank_name: row.bank_name as string,
      login: row.login as string,
      password: row.password_encrypted ? decryptAccessPassword(row.password_encrypted as string) : "",
      status: row.status as string,
      stores: row.stores as string[],
      created_at: row.created_at as string,
      password_changed_at: row.password_changed_at as string | null,
    }));

    const idsWithPasswords = result.rows.filter((row) => row.password_encrypted).map((row) => row.id as string);
    if (idsWithPasswords.length) {
      await pool.query(
        "insert into audit_log (user_id, action, entity_type, entity_id, details) select $1, 'export_password', 'access', exported.id, $3::jsonb from unnest($2::uuid[]) as exported(id)",
        [user.id, idsWithPasswords, JSON.stringify({ channel: "csv" })],
      );
    }

    return NextResponse.json(rows, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível preparar a exportação." }, { status: 500 });
  }
}
