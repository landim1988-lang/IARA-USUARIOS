"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, LoaderCircle, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";

type Team = { id: string; name: string; responsible: string | null; notes: string | null };
const emptyForm = { name: "", responsible: "", notes: "" };

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadTeams() {
    setLoading(true);
    const response = await fetch("/api/data?table=teams");
    const data = await response.json().catch(() => []);
    if (!response.ok) setError("Não foi possível carregar as equipes do Neon.");
    else setTeams(data as Team[]);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialTeams() {
      const response = await fetch("/api/data?table=teams");
      const data = await response.json().catch(() => []);
      if (cancelled) return;
      if (!response.ok) setError("Não foi possível carregar as equipes do Neon.");
      else setTeams(data as Team[]);
      setLoading(false);
    }
    void loadInitialTeams();
    return () => { cancelled = true; };
  }, []);

  function openCreate() { setEditing(null); setForm(emptyForm); setError(""); setModalOpen(true); }
  function openEdit(team: Team) { setEditing(team); setForm({ name: team.name, responsible: team.responsible ?? "", notes: team.notes ?? "" }); setError(""); setModalOpen(true); }

  async function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = { name: form.name.trim(), responsible: form.responsible.trim() || null, notes: form.notes.trim() || null };
    if (payload.name.length < 2) { setError("Informe um nome de equipe válido."); setSaving(false); return; }
    const response = await fetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "teams", id: editing?.id, values: payload }) });
    if (!response.ok) { setError(response.status === 409 ? "Já existe uma equipe com esse nome." : "Não foi possível salvar a equipe no Neon."); setSaving(false); return; }
    setModalOpen(false); setSaving(false); await loadTeams();
  }

  async function deleteTeam(team: Team) {
    if (!window.confirm(`Excluir a equipe ${team.name}?`)) return;
    const response = await fetch("/api/data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table: "teams", id: team.id }) });
    if (!response.ok) setError("Esta equipe ainda está vinculada a acessos e não pode ser excluída.");
    else await loadTeams();
  }

  const filteredTeams = teams.filter((team) => team.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) || (team.responsible ?? "").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">CADASTROS</span><h1>Equipes</h1><p>Organize quem utiliza cada acesso bancário.</p></div><button className="primary-button" onClick={openCreate}><Plus size={17} /> Nova equipe</button></div>
      <section className="panel data-panel"><div className="table-toolbar"><div className="table-count"><strong>{teams.length}</strong> {teams.length === 1 ? "equipe" : "equipes"}</div><label className="search-field"><Search size={16} /><input aria-label="Buscar equipe" placeholder="Buscar equipe ou responsável" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {loading ? <div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando equipes</div> : filteredTeams.length === 0 ? <div className="empty-state"><span className="empty-state-icon"><Users size={22} /></span><h2>{teams.length ? "Nenhum resultado" : "Nenhuma equipe cadastrada"}</h2><p>{teams.length ? "Tente outro termo de busca." : "As equipes Stilo Salão e Stilo Callcenter serão adicionadas ao aplicar a migração inicial."}</p>{!teams.length && <button className="primary-button" onClick={openCreate}><Plus size={16} /> Cadastrar equipe</button>}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Equipe</th><th>Responsável</th><th>Observações</th><th className="actions-heading">Ações</th></tr></thead><tbody>{filteredTeams.map((team) => <tr key={team.id}><td><Link href={`/teams/${team.id}`} className="team-table-link"><span className="team-initial team-initial-orange">{team.name.slice(0, 1).toUpperCase()}</span><strong>{team.name}</strong><ArrowUpRight size={14} /></Link></td><td>{team.responsible || <span className="muted-cell">Não informado</span>}</td><td className="notes-cell">{team.notes || <span className="muted-cell">—</span>}</td><td><div className="row-actions"><button className="icon-button" aria-label={`Editar ${team.name}`} title="Editar" onClick={() => openEdit(team)}><Pencil size={16} /></button><button className="icon-button danger-action" aria-label={`Excluir ${team.name}`} title="Excluir" onClick={() => void deleteTeam(team)}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div>}
      </section>
      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title"><div className="modal-heading"><div><span className="eyebrow">EQUIPE</span><h2 id="team-modal-title">{editing ? "Editar equipe" : "Nova equipe"}</h2></div><button className="icon-button" aria-label="Fechar" onClick={() => setModalOpen(false)}><X size={19} /></button></div><form className="form-grid" onSubmit={saveTeam}><label className="field-span">Nome da equipe<input required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoFocus /></label><label className="field-span">Responsável<input maxLength={120} placeholder="Nome do responsável" value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} /></label><label className="field-span">Observações<textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>{error && <p className="inline-error field-span">{error}</p>}<div className="modal-actions field-span"><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar equipe"}</button></div></form></section></div>}
    </>
  );
}
