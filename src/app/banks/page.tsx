"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { Building2, ExternalLink, LoaderCircle, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";

type Bank = { id: string; name: string; color: string; portal_url: string | null; logo_url: string | null; is_active: boolean; notes: string | null };
const emptyForm = { name: "", color: "#18264d", portal_url: "", logo_url: "", is_active: true, notes: "" };

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Bank | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");

  async function loadBanks() {
    setLoading(true);
    const response = await fetch("/api/data?table=banks");
    const data = await response.json().catch(() => []);
    if (!response.ok) setError("Não foi possível carregar os bancos do Neon.");
    else setBanks(data as Bank[]);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialBanks() {
      const response = await fetch("/api/data?table=banks");
      const data = await response.json().catch(() => []);
      if (cancelled) return;
      if (!response.ok) setError("Não foi possível carregar os bancos do Neon.");
      else setBanks(data as Bank[]);
      setLoading(false);
    }
    void loadInitialBanks();
    return () => { cancelled = true; };
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(bank: Bank) {
    setEditing(bank);
    setForm({ name: bank.name, color: bank.color, portal_url: bank.portal_url ?? "", logo_url: bank.logo_url ?? "", is_active: bank.is_active, notes: bank.notes ?? "" });
    setError("");
    setModalOpen(true);
  }

  async function saveBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = { ...form, name: form.name.trim(), portal_url: form.portal_url.trim() || null, logo_url: form.logo_url.trim() || null, notes: form.notes.trim() || null };
    const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "banks", id: editing?.id, values: payload }) });
    if (!response.ok) {
      setError(response.status === 409 ? "Já existe um banco com esse nome." : "Não foi possível salvar o banco no Neon.");
      setSaving(false);
      return;
    }
    setModalOpen(false);
    setSaving(false);
    await loadBanks();
  }

  async function enrichBank() {
    setEnriching(true);
    setError("");
    try {
      const response = await fetch("/api/banks/enrich", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, portal_url: form.portal_url }) });
      const result = await response.json().catch(() => ({})) as { error?: string; name?: string; portal_url?: string | null; logo_url?: string | null; notes?: string | null };
      if (!response.ok) throw new Error(result.error || "Não foi possível buscar a logo do portal.");
      setForm((current) => ({ ...current, name: result.name ?? current.name, portal_url: result.portal_url ?? current.portal_url, logo_url: result.logo_url ?? current.logo_url, notes: result.notes ?? current.notes }));
    } catch (enrichError) {
      setError(enrichError instanceof Error ? enrichError.message : "Não foi possível buscar a logo do portal.");
    } finally {
      setEnriching(false);
    }
  }

  async function deleteBank(bank: Bank) {
    if (!window.confirm(`Excluir o banco ${bank.name}?`)) return;
    const response = await fetch("/api/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "banks", id: bank.id }) });
    if (!response.ok) setError("Este banco possui acessos vinculados e não pode ser excluído.");
    else await loadBanks();
  }

  const filteredBanks = banks.filter((bank) => bank.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">CADASTROS</span><h1>Bancos</h1><p>Gerencie as instituições e seus portais de acesso.</p></div>
        <button className="primary-button" onClick={openCreate}><Plus size={17} /> Novo banco</button>
      </div>
      <section className="panel data-panel">
        <div className="table-toolbar"><div className="table-count"><strong>{banks.length}</strong> {banks.length === 1 ? "banco cadastrado" : "bancos cadastrados"}</div><label className="search-field"><Search size={16} /><input aria-label="Buscar banco" placeholder="Buscar banco" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {loading ? <div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando bancos</div> : filteredBanks.length === 0 ? (
          <div className="empty-state"><span className="empty-state-icon"><Building2 size={22} /></span><h2>{banks.length ? "Nenhum resultado" : "Nenhum banco cadastrado"}</h2><p>{banks.length ? "Tente outro termo de busca." : "Cadastre os bancos usados pela loja para começar a organizar os acessos."}</p>{!banks.length && <button className="primary-button" onClick={openCreate}><Plus size={16} /> Cadastrar banco</button>}</div>
        ) : (
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Banco</th><th>Portal</th><th>Status</th><th className="actions-heading">Ações</th></tr></thead><tbody>{filteredBanks.map((bank) => <tr key={bank.id}><td><span className="bank-cell">{bank.logo_url ? <Image className="bank-logo" src={bank.logo_url} alt={`Logo de ${bank.name}`} width={28} height={28} unoptimized onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <i className="bank-swatch" style={{ background: bank.color }} />}<span><strong>{bank.name}</strong><small>{bank.notes || "Sem observações"}</small></span></span></td><td>{bank.portal_url ? <a className="portal-link" href={bank.portal_url} target="_blank" rel="noreferrer">Abrir portal <ExternalLink size={13} /></a> : <span className="muted-cell">Não informado</span>}</td><td><span className={`status-badge ${bank.is_active ? "status-active" : "status-canceled"}`}><i />{bank.is_active ? "Ativo" : "Inativo"}</span></td><td><div className="row-actions"><button className="icon-button" aria-label={`Editar ${bank.name}`} title="Editar" onClick={() => openEdit(bank)}><Pencil size={16} /></button><button className="icon-button danger-action" aria-label={`Excluir ${bank.name}`} title="Excluir" onClick={() => void deleteBank(bank)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>
        )}
      </section>
      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="bank-modal-title"><div className="modal-heading"><div><span className="eyebrow">INSTITUIÇÃO</span><h2 id="bank-modal-title">{editing ? "Editar banco" : "Novo banco"}</h2></div><button className="icon-button" aria-label="Fechar" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form className="form-grid" onSubmit={saveBank}><label className="field-span">Nome do banco<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label><div className="field-span ai-enrich-row"><button type="button" className="secondary-button" onClick={() => void enrichBank()} disabled={enriching || !form.name.trim()}><Sparkles size={15} />{enriching ? "Buscando logo..." : "Buscar logo pelo banco"}</button><span>A URL do portal é opcional; a logo será localizada pelo nome.</span></div><label>Cor da identificação<span className="color-field"><input type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /><code>{form.color.toUpperCase()}</code></span></label><label>URL do portal<input type="url" placeholder="Opcional: https://" value={form.portal_url} onChange={(event) => setForm({ ...form, portal_url: event.target.value })} /></label><label className="field-span">URL da logo<input type="url" placeholder="Preenchida pela busca" value={form.logo_url} onChange={(event) => setForm({ ...form, logo_url: event.target.value })} />{form.logo_url && <span className="logo-preview"><Image src={form.logo_url} alt={`Logo de ${form.name || "banco"}`} width={40} height={40} unoptimized onError={(event) => { event.currentTarget.style.display = "none"; }} /><span>Logo sugerida — confirme antes de salvar</span></span>}</label><label className="field-span">Observações<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="toggle-field field-span"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /><span>Banco ativo</span></label>{error && <p className="inline-error field-span">{error}</p>}<div className="modal-actions field-span"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar banco"}</button></div></form></section></div>}
    </>
  );
}
