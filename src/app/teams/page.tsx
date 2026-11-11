import { redirect } from "next/navigation";
import { getCurrentUser, pool } from "@/lib/access-control";
import StoresManager, { type Store } from "./stores-manager";

export default async function StoresPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const result = user.role === "master"
    ? await pool.query("select id, name, responsible, notes from stores order by name asc")
    : user.storeId
      ? await pool.query("select id, name, responsible, notes from stores where id = $1", [user.storeId])
      : { rows: [] };
  return <StoresManager initialStores={result.rows as Store[]} isMaster={user.role === "master"} />;
}
