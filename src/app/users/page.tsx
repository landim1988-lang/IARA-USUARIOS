import { redirect } from "next/navigation";
import { getCurrentUser, pool } from "@/lib/access-control";
import UsersManager, { type ManagedUser, type UserStore } from "./users-manager";

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "master") return <section className="panel empty-state"><h1>Acesso restrito</h1><p>Somente o usuário Master pode gerenciar as contas.</p></section>;
  const [users, stores] = await Promise.all([
    pool.query('select u.id, u.name, u.email, u.role, u.store_id, s.name as store_name from public."user" u left join public.stores s on s.id = u.store_id order by u.role desc, u.name asc'),
    pool.query("select id, name from stores order by name asc"),
  ]);
  return <UsersManager initialUsers={users.rows as ManagedUser[]} stores={stores.rows as UserStore[]} />;
}
