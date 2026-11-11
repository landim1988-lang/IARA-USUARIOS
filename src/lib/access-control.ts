import { headers } from "next/headers";
import { Pool } from "pg";
import { auth } from "@/lib/auth";

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export type UserContext = {
  id: string;
  name: string;
  email: string;
  role: "master" | "admin";
  storeId: string | null;
};

export async function getCurrentUser(): Promise<UserContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const result = await pool.query<{ role: "master" | "admin"; store_id: string | null }>(
    'select role, store_id from public."user" where id = $1 limit 1',
    [session.user.id],
  );
  const profile = result.rows[0];
  if (!profile) return null;

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: profile.role,
    storeId: profile.store_id,
  };
}
