"use client";

import { useState, type FormEvent } from "react";
import { ArrowUpRight, Building2, LoaderCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";

export type Store = { id: string; name: string; responsible: string | null; notes: string | null };
const emptyForm = { name: "", responsible: "", notes: "" };

export default function StoresManager({ initialStores, isMaster }: { initialStores: Store[]; isMaster: boolean }) {
  const [stores, setStores] = useState(initialStores);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Store | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openCreate() { setEditing(null); setForm(emptyForm); setError(""); setModalOpen(true); }
  function openEdit(store: Store) { setEditing(store); setForm({ name: store.name, responsible: store.responsible ?? "", notes: store.notes ?? "" }); setError(""); setModalOpen(true); }

  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const values = { name: form.name.trim(), responsible: form.responsible.trim() || null, notes: form.notes.trim() || null };
    if (values.name.length < 2) { setError("Informe um nome de loja válido."); setSaving(false); return; }
    const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "stores", id: editing?.id, values }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.error ?? "Não foi possível salvar a loja."); setSaving(false); return; }
    setStores((current) => [...current.filter((store) => store.id !== data.id), data as Store].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    setModalOpen(false);
    setSaving(false);
  }

  async function deleteStore(store: Store) {
    if (!window.confirm(`Excluir a loja ${store.name}?`)) return;
    const response = await fetch("/api/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "stores", id: store.id }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Não foi possível excluir a loja.");
    else setStores((current) => current.filter((item) => item.id !== store.id));
  }

  const query = search.toLocaleLowerCase("pt-BR");
  const filteredStores = stores.filter((store) => `${store.name} ${store.responsible ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">CADASTROS</span><h1>{isMaster ? "Lojas" : "Minha loja"}</h1><p>{isMaster ? "Cadastre lojas e acompanhe os acessos vinculados a cada operação." : "Veja a loja vinculada à sua conta e aos seus acessos."}</p></div>{isMaster && <button className="primary-button" onClick={openCreate}><Plus size={17} /> Nova loja</button>}</div>
      <section className="panel data-panel"><div className="table-toolbar"><div className="table-count"><strong>{stores.length}</strong> {stores.length === 1 ? "loja" : "lojas"}</div>{stores.length > 1 && <label className="search-field"><Search size={16} /><input aria-label="Buscar loja" placeholder="Buscar loja ou responsável" value={search} onChange={(event) => setSearch(event.target.value)} /></label>}</div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {filteredStores.length === 0 ? <div className="empty-state"><span className="empty-state-icon"><Building2 size={22} /></span><h2>{stores.length ? "Nenhum resultado" : isMaster ? "Nenhuma loja cadastrada" : "Sua conta ainda não tem loja"}</h2><p>{stores.length ? "Tente outro termo de busca." : isMaster ? "Cadastre a primeira loja para começar a organizar usuários e acessos." : "Peça ao Master para vincular sua conta a uma loja."}</p>{isMaster && !stores.length && <button className="primary-button" onClick={openCreate}><Plus size={16} /> Cadastrar loja</button>}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Loja</th><th>Responsável</th><th>Observações</th>{isMaster && <th className="actions-heading">Ações</th>}</tr></thead><tbody>{filteredStores.map((store) => <tr key={store.id}><td><span className="access-bank-cell"><span className="team-initial team-initial-orange">{store.name.slice(0, 1).toUpperCase()}</span><strong>{store.name}</strong><ArrowUpRight size={14} aria-hidden="true" /></span></td><td>{store.responsible || <span className="muted-cell">Não informado</span>}</td><td className="notes-cell">{store.notes || <span className="muted-cell">—</span>}</td>{isMaster && <td><div className="row-actions"><button className="icon-button" aria-label={`Editar ${store.name}`} title="Editar" onClick={() => openEdit(store)}><Pencil size={16} /></button><button className="icon-button danger-action" aria-label={`Excluir ${store.name}`} title="Excluir" onClick={() => void deleteStore(store)}><Trash2 size={16} /></button></div></td>}</tr>)}</tbody></table></div>}
      </section>
      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="store-modal-title"><div className="modal-heading"><div><span className="eyebrow">LOJA</span><h2 id="store-modal-title">{editing ? "Editar loja" : "Nova loja"}</h2></div><button className="icon-button" aria-label="Fechar" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form className="form-grid" onSubmit={saveStore}><label className="field-span">Nome da loja<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label><label className="field-span">Responsável<input maxLength={120} placeholder="Nome do responsável" value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} /></label><label className="field-span">Observações<textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>{error && <p className="inline-error field-span" role="alert">{error}</p>}<div className="modal-actions field-span"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <><LoaderCircle size={15} className="spin" /> Salvando...</> : editing ? "Salvar alterações" : "Cadastrar loja"}</button></div></form></section></div>}
    </>
  );
}
