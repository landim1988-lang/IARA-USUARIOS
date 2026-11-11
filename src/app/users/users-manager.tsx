"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus, UserRoundCog } from "lucide-react";

export type UserStore = { id: string; name: string };
export type ManagedUser = { id: string; name: string; email: string; role: "master" | "admin"; store_id: string | null; store_name: string | null };

export default function UsersManager({ initialUsers, stores }: { initialUsers: ManagedUser[]; stores: UserStore[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const response = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password, store_id: storeId }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.error ?? "Não foi possível criar o usuário."); setSaving(false); return; }
    setUsers((current) => [...current, { ...data, store_name: stores.find((store) => store.id === data.store_id)?.name ?? null }].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    setName(""); setEmail(""); setPassword("");
    setNotice("Conta criada. Compartilhe a senha inicial com a pessoa por um canal seguro e oriente-a a alterá-la.");
    setSaving(false);
  }

  async function updateStore(user: ManagedUser, nextStoreId: string) {
    setError("");
    setUpdating(user.id);
    const response = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, store_id: nextStoreId || null }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Não foi possível atualizar a loja do usuário.");
    else setUsers((current) => current.map((item) => item.id === user.id ? { ...item, store_id: data.store_id, store_name: stores.find((store) => store.id === data.store_id)?.name ?? null } : item));
    setUpdating(null);
  }

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">ACESSO AO SISTEMA</span><h1>Usuários</h1><p>Crie administradores e limite cada conta à sua loja.</p></div></div>
      <section className="panel data-panel"><div className="panel-heading"><div><h2><UserRoundCog size={18} /> Criar administrador</h2><p>A conta terá acesso somente à loja selecionada.</p></div></div>
        {stores.length === 0 ? <p className="inline-error">Cadastre uma loja antes de criar usuários.</p> : <form className="form-grid" onSubmit={createUser}><label>Nome<input required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><label>E-mail<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Senha inicial<input required type="password" autoComplete="new-password" minLength={14} maxLength={200} value={password} onChange={(event) => setPassword(event.target.value)} /><small>Use pelo menos 14 caracteres. A senha não será exibida novamente.</small></label><label>Loja<select required value={storeId} onChange={(event) => setStoreId(event.target.value)}>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>{error && <p className="inline-error field-span" role="alert">{error}</p>}{notice && <p className="success-notice field-span" role="status">{notice}</p>}<div className="modal-actions field-span"><button type="submit" className="primary-button" disabled={saving || !storeId}>{saving ? <><LoaderCircle size={15} className="spin" /> Criando...</> : <><Plus size={16} /> Criar usuário</>}</button></div></form>}
      </section>
      <section className="panel data-panel"><div className="table-toolbar"><div><h2>Contas cadastradas</h2><span className="table-count"><strong>{users.length}</strong> {users.length === 1 ? "usuário" : "usuários"}</span></div></div>{error && stores.length > 0 && <p className="inline-error" role="alert">{error}</p>}
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Usuário</th><th>Perfil</th><th>Loja</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td><span className="status-badge status-active"><i />{user.role === "master" ? "Master" : "Administrador"}</span></td><td>{user.role === "master" ? <span className="muted-cell">Todas as lojas</span> : <select aria-label={`Loja de ${user.name}`} value={user.store_id ?? ""} disabled={updating === user.id} onChange={(event) => void updateStore(user, event.target.value)}><option value="">Sem loja atribuída</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select>}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}
