"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDownToLine, ArrowUpRight, Eye, EyeOff, FileKey2, Filter, LoaderCircle, Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AccessRow = {
  id: string; login: string; status: "active" | "blocked" | "canceled"; created_at: string; updated_at: string; password_changed_at: string | null;
  banks: { id: string; name: string; color: string; logo_url: string | null } | null;
  access_teams: { team_id: string; teams: { id: string; name: string } | null }[];
};
type Bank = { id: string; name: string };
type Team = { id: string; name: string };
const statusLabels = { active: "Ativo", blocked: "Bloqueado", canceled: "Cancelado" };

function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export default function AccessesPage() {
  const [accesses, setAccesses] = useState<AccessRow[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const client = createClient();
      const [{ data: accessData, error: accessError }, { data: bankData }, { data: teamData }] = await Promise.all([
        client.from("accesses").select("id,login,status,created_at,updated_at,password_changed_at,banks(id,name,color,logo_url),access_teams(team_id,teams(id,name))").order("updated_at", { ascending: false }),
        client.from("banks").select("id,name").order("name"),
        client.from("teams").select("id,name").order("name"),
      ]);
      if (cancelled) return;
      if (accessError) setError("Não foi possível carregar os acessos. Confira a configuração do Supabase.");
      else setAccesses((accessData ?? []) as unknown as AccessRow[]);
      setBanks((bankData ?? []) as Bank[]);
      setTeams((teamData ?? []) as Team[]);
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, []);

  const filtered = accesses.filter((access) => {
    const query = search.toLocaleLowerCase("pt-BR");
    const searchable = `${access.login} ${access.banks?.name ?? ""} ${access.access_teams.map((link) => link.teams?.name ?? "").join(" ")}`.toLocaleLowerCase("pt-BR");
    return searchable.includes(query) && (!bankFilter || access.banks?.id === bankFilter) && (!statusFilter || access.status === statusFilter) && (!teamFilter || access.access_teams.some((link) => link.team_id === teamFilter));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function revealPassword(id: string) {
    if (revealed[id]) { setRevealed((current) => { const next = { ...current }; delete next[id]; return next; }); return; }
    const { data, error: revealError } = await createClient().rpc("reveal_access_password", { p_access_id: id });
    if (revealError) setError("Não foi possível revelar a senha. Verifique se a chave do Vault está configurada.");
    else setRevealed((current) => ({ ...current, [id]: data as string }));
  }

  async function copyPassword(id: string) {
    let value = revealed[id];
    if (!value) {
      const { data, error: revealError } = await createClient().rpc("reveal_access_password", { p_access_id: id });
      if (revealError) { setError("Não foi possível copiar a senha. Verifique a configuração do Vault."); return; }
      value = data as string;
    }
    await navigator.clipboard.writeText(value);
    setError("");
  }

  function exportCsv() {
    const header = ["Banco", "Login", "Status", "Equipes", "Criado em", "Última troca de senha"];
    const rows = filtered.map((access) => [access.banks?.name ?? "", access.login, statusLabels[access.status], access.access_teams.map((link) => link.teams?.name ?? "").filter(Boolean).join("; "), new Date(access.created_at).toLocaleDateString("pt-BR"), access.password_changed_at ? new Date(access.password_changed_at).toLocaleDateString("pt-BR") : ""]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "stilo-acessos.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">GESTÃO DE CREDENCIAIS</span><h1>Acessos</h1><p>Logins bancários compartilhados pelas equipes.</p></div><Link className="primary-button" href="/accesses/new"><Plus size={17} /> Cadastrar acesso</Link></div>
      <nav className="access-tabs" aria-label="Seções de acessos"><Link className="access-tab access-tab-active" href="/accesses">Acessos cadastrados</Link><Link className="access-tab" href="/accesses/new">Cadastrar acessos</Link></nav>
      <section className="panel data-panel"><div className="table-toolbar"><div className="table-count"><strong>{filtered.length}</strong> {filtered.length === 1 ? "acesso" : "acessos"}</div><div className="toolbar-actions"><label className="search-field"><Search size={16} /><input aria-label="Buscar acesso" placeholder="Buscar login ou equipe" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button className="secondary-button" onClick={exportCsv} disabled={!filtered.length}><ArrowDownToLine size={15} /> Exportar CSV</button><Link className="secondary-button" href="/accesses/backup"><FileKey2 size={15} /> Backup</Link></div></div>
        <div className="filter-row"><span><Filter size={14} />Filtros</span><select aria-label="Filtrar por banco" value={bankFilter} onChange={(event) => setBankFilter(event.target.value)}><option value="">Todos os bancos</option>{banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}</select><select aria-label="Filtrar por equipe" value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">Todas as equipes</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        {loading ? <div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando acessos</div> : filtered.length === 0 ? <div className="empty-state"><span className="empty-state-icon"><FileKey2 size={22} /></span><h2>{accesses.length ? "Nenhum acesso encontrado" : "Nenhum acesso cadastrado"}</h2><p>{accesses.length ? "Ajuste os filtros ou a busca." : "Cadastre um acesso para começar a acompanhar as credenciais da loja."}</p>{!accesses.length && banks.length > 0 && <Link className="primary-button" href="/accesses/new"><Plus size={16} /> Cadastrar acesso</Link>}{!accesses.length && banks.length === 0 && <Link className="text-link" href="/banks">Cadastre um banco primeiro <ArrowUpRight size={14} /></Link>}</div> : <div className="table-scroll"><table className="data-table accesses-table"><thead><tr><th>Banco / login</th><th>Senha</th><th>Equipes</th><th>Status</th><th>Última alteração</th><th className="actions-heading">Detalhes</th></tr></thead><tbody>{paginated.map((access) => <tr key={access.id}><td><span className="access-bank-cell">{access.banks?.logo_url ? <Image className="bank-logo" src={access.banks.logo_url} alt="" width={28} height={28} unoptimized /> : <i className="bank-swatch" style={{ background: access.banks?.color ?? "#18264d" }} />}<span><strong>{access.banks?.name ?? "Banco removido"}</strong><small>{access.login}</small></span></span></td><td><span className="secret-cell"><span>{revealed[access.id] ?? "••••••••••••"}</span><button className="icon-button secret-action" title={revealed[access.id] ? "Ocultar senha" : "Revelar senha"} aria-label={revealed[access.id] ? "Ocultar senha" : "Revelar senha"} onClick={() => void revealPassword(access.id)}>{revealed[access.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button><button className="icon-button secret-action" title="Copiar senha" aria-label="Copiar senha" onClick={() => void copyPassword(access.id)}><span className="copy-glyph">⧉</span></button></span></td><td><span className="badge-list">{access.access_teams.length ? access.access_teams.map((link) => link.teams && <span className="team-badge" key={link.team_id}>{link.teams.name}</span>) : <span className="unassigned-badge">Sem equipe</span>}</span></td><td><span className={`status-badge status-${access.status}`}><i />{statusLabels[access.status]}</span></td><td><time className="last-change" dateTime={access.updated_at}>{new Date(access.updated_at).toLocaleString("pt-BR")}</time></td><td><Link className="icon-button details-action" href={`/accesses/${access.id}`} aria-label={`Detalhes de ${access.login}`} title="Detalhes"><ArrowUpRight size={17} /></Link></td></tr>)}</tbody></table></div>}
        {pageCount > 1 && <div className="table-pagination"><span>Página {page} de {pageCount}</span><div><button className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Anterior</button><button className="secondary-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Próxima</button></div></div>}
      </section>
    </>

  );
}
