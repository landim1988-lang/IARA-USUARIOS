"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FastEdit } from "./fast-edit";
import { AccessFilters } from "./access-filters";
import { AccessReport } from "./access-report";
import { ArrowDownToLine, ArrowUpRight, Eye, EyeOff, FileKey2, LoaderCircle, Plus, ArrowUpDown } from "lucide-react";

type AccessRow = {
  id: string; bank_id: string; login: string; portal_url: string | null; status: "active" | "blocked" | "canceled"; created_at: string; updated_at: string; password_changed_at: string | null; password_expires_at: string | null; cpf_titular: string | null; notes: string | null;
  banks: { id: string; name: string; color: string; logo_url: string | null } | null;
  access_stores: { store_id: string; stores: { id: string; name: string } | null }[];
};
type Bank = { id: string; name: string };
type Store = { id: string; name: string };
const statusLabels = { active: "Ativo", blocked: "Bloqueado", canceled: "Cancelado" };
const pageTimestamp = Date.now();

type ExpiryFilter = "all" | "expired" | "next7" | "none";

function daysUntilExpiry(value: string | null) {
  if (!value) return null;
  const today = new Date(pageTimestamp).toISOString().slice(0, 10);
  return Math.ceil((Date.parse(`${value.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

function csvCell(value: string) {
  const safeValue = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
function portalHref(value: string | null) { if (!value) return null; try { return new URL(value.match(/^https?:\/\//i) ? value : `https://${value}`).toString(); } catch { return null; } }

export default function AccessesPage() {
  const [accesses, setAccesses] = useState<AccessRow[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [search, setSearch] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryFilter>("all");
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"acessos" | "consulta" | "relatorios">("acessos");
  const [sort, setSort] = useState<"bank" | "login" | "password">("bank");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [expiryDrafts, setExpiryDrafts] = useState<Record<string, string>>({});
  const [savingExpiry, setSavingExpiry] = useState<string | null>(null);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      const [accessResponse, bankResponse, storeResponse] = await Promise.all([fetch("/api/accesses"), fetch("/api/data?table=banks"), fetch("/api/data?table=stores")]);
      const [accessData, bankData, storeData] = await Promise.all([accessResponse.json(), bankResponse.json(), storeResponse.json()]);
      if (cancelled) return;
      if (!accessResponse.ok) setError("Não foi possível carregar os acessos do Neon.");
      else setAccesses((accessData ?? []).map((row: Record<string, unknown>) => ({ ...row, banks: row.bank_name ? { id: row.bank_id_ref as string, name: row.bank_name as string, color: row.bank_color as string, logo_url: row.logo_url as string | null, portal_url: row.portal_url as string | null } : null, access_stores: Array.isArray(row.access_stores) ? row.access_stores as AccessRow["access_stores"] : [] })) as AccessRow[]);
      setBanks((bankData ?? []) as Bank[]);
      setStores((storeData ?? []) as Store[]);
      setLoading(false);
    }
    void loadInitialData();
    return () => { cancelled = true; };
  }, []);

  const filtered = accesses.filter((access) => {
    const query = search.toLocaleLowerCase("pt-BR");
    const searchable = `${access.login} ${access.banks?.name ?? ""} ${access.access_stores.map((link) => link.stores?.name ?? "").join(" ")}`.toLocaleLowerCase("pt-BR");
    const createdDate = access.created_at.slice(0, 10);
    const days = daysUntilExpiry(access.password_expires_at);
    const matchesExpiry = expiryFilter === "all"
      || (expiryFilter === "expired" && days !== null && days < 0)
      || (expiryFilter === "next7" && days !== null && days >= 0 && days <= 7)
      || (expiryFilter === "none" && days === null);
    return searchable.includes(query)
      && (!bankFilter || access.banks?.id === bankFilter)
      && (!statusFilter || access.status === statusFilter)
      && (!storeFilter || access.access_stores.some((link) => link.store_id === storeFilter))
      && (!createdFrom || createdDate >= createdFrom)
      && (!createdTo || createdDate <= createdTo)
      && matchesExpiry;
  });
  const consultationRows = [...filtered].sort((a, b) => {
    const left = sort === "bank" ? a.banks?.name ?? "" : sort === "login" ? a.login : revealed[a.id] ?? "";
    const right = sort === "bank" ? b.banks?.name ?? "" : sort === "login" ? b.login : revealed[b.id] ?? "";
    return left.localeCompare(right, "pt-BR") * (direction === "asc" ? 1 : -1);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  function changeSort(next: "bank" | "login" | "password") { if (sort === next) setDirection((current) => current === "asc" ? "desc" : "asc"); else { setSort(next); setDirection("asc"); } }
  const sortLabel = (key: "bank" | "login" | "password") => <button className="table-sort-button" type="button" onClick={() => changeSort(key)}>{key === "bank" ? "Banco" : key === "login" ? "Login" : "Senha"}<ArrowUpDown size={13} /></button>;
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function revealPassword(id: string) {
    if (revealed[id]) { setRevealed((current) => { const next = { ...current }; delete next[id]; return next; }); return; }
    const response = await fetch("/api/accesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Não foi possível revelar a senha.");
    else setRevealed((current) => ({ ...current, [id]: data.password }));
  }

  function expiryState(value: string | null) {
    const days = daysUntilExpiry(value);
    if (days === null) return "none";
    return days <= 3 ? "critical" : days <= 7 ? "warning" : "safe";
  }

  function expiryLabel(value: string | null) {
    if (!value) return "Sem aviso de expiração";
    return `Expira em ${new Date(value).toLocaleDateString("pt-BR")}`;
  }

  async function saveExpiry(id: string, value: string) {
    setSavingExpiry(id);
    const response = await fetch("/api/accesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, password_expires_at: value || null }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Não foi possível salvar a expiração.");
    else { setAccesses((current) => current.map((access) => access.id === id ? { ...access, password_expires_at: value || null, updated_at: new Date().toISOString() } : access)); setError(""); }
    setSavingExpiry(null);
  }

  async function copyPassword(id: string) {
    let value = revealed[id];
    if (!value) {
      const response = await fetch("/api/accesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Não foi possível copiar a senha."); return; }
      value = data.password;
    }
    await navigator.clipboard.writeText(value);
    setError("");
  }

  function exportCsv() {
    const header = ["Banco", "Login", "Status", "Lojas", "Criado em", "Última troca de senha"];
    const rows = filtered.map((access) => [access.banks?.name ?? "", access.login, statusLabels[access.status], access.access_stores.map((link) => link.stores?.name ?? "").filter(Boolean).join("; "), new Date(access.created_at).toLocaleDateString("pt-BR"), access.password_changed_at ? new Date(access.password_changed_at).toLocaleDateString("pt-BR") : ""]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "credipi-acessos.csv"; anchor.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="page-heading"><div><span className="eyebrow">GESTÃO DE CREDENCIAIS</span><h1>Acessos</h1><p>Logins bancários compartilhados pelas lojas.</p></div><Link className="primary-button" href="/accesses/new"><Plus size={17} /> Cadastrar acesso</Link></div>
      <nav className="access-tabs" aria-label="Seções de acessos"><button className={`access-tab ${view === "acessos" ? "access-tab-active" : ""}`} type="button" aria-pressed={view === "acessos"} onClick={() => setView("acessos")}>Acessos cadastrados</button><button className={`access-tab ${view === "consulta" ? "access-tab-active" : ""}`} type="button" aria-pressed={view === "consulta"} onClick={() => setView("consulta")}>Consulta</button><button className={`access-tab ${view === "relatorios" ? "access-tab-active" : ""}`} type="button" aria-pressed={view === "relatorios"} onClick={() => setView("relatorios")}>Relatórios</button><Link className="access-tab" href="/accesses/new">Cadastrar acessos</Link></nav>
      <AccessFilters resultCount={filtered.length} search={search} bankFilter={bankFilter} storeFilter={storeFilter} statusFilter={statusFilter} createdFrom={createdFrom} createdTo={createdTo} expiryFilter={expiryFilter} banks={banks} stores={stores} onSearchChange={(value) => { setSearch(value); setPage(1); }} onBankChange={(value) => { setBankFilter(value); setPage(1); }} onStoreChange={(value) => { setStoreFilter(value); setPage(1); }} onStatusChange={(value) => { setStatusFilter(value); setPage(1); }} onCreatedFromChange={(value) => { setCreatedFrom(value); setPage(1); }} onCreatedToChange={(value) => { setCreatedTo(value); setPage(1); }} onExpiryChange={(value) => { setExpiryFilter(value); setPage(1); }} onClear={() => { setSearch(""); setBankFilter(""); setStoreFilter(""); setStatusFilter(""); setCreatedFrom(""); setCreatedTo(""); setExpiryFilter("all"); setPage(1); }} />
      {error && <p className="inline-error" role="alert">{error}</p>}
      {view === "relatorios" && (loading ? <section className="panel data-panel report-panel"><div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando relatório</div></section> : <AccessReport accesses={filtered} stores={stores} storeFilter={storeFilter} />)}
      {view === "consulta" && <section className="panel data-panel consultation-panel"><div className="table-toolbar"><div className="table-count"><strong>{consultationRows.length}</strong> acessos para consulta</div><p className="consultation-note">Consulta rápida de Banco, Login e Senha. Clique nos títulos para ordenar.</p></div><div className="table-scroll"><table className="data-table"><thead><tr><th>{sortLabel("bank")}</th><th>URL do banco</th><th>{sortLabel("login")}</th><th>{sortLabel("password")}</th><th>Expiração</th></tr></thead><tbody>{consultationRows.map((access) => <tr key={access.id} className={`consultation-row expiry-${expiryState(access.password_expires_at)}`}><td><span className="access-bank-cell consultation-bank-wrap"><span className="consultation-bank-logo">{access.banks?.logo_url ? <Image src={access.banks.logo_url} alt={`Logo de ${access.banks.name ?? "banco"}`} width={28} height={28} unoptimized /> : <i className="bank-swatch" style={{ background: access.banks?.color ?? "#18264d" }} />}<strong>{access.banks?.name ?? "Banco removido"}</strong></span><span className="consultation-hover-card"><b>{access.banks?.name ?? "Banco removido"}</b><span>Status: {statusLabels[access.status]}</span><span>CPF: {access.cpf_titular || "Não informado"}</span><span>Última atualização: {new Date(access.updated_at).toLocaleDateString("pt-BR")}</span><span>{expiryLabel(access.password_expires_at)}</span>{access.notes && <span>Observações: {access.notes}</span>}</span></span></td><td><span className="copyable-cell">{portalHref(access.portal_url) ? <a href={portalHref(access.portal_url)!} target="_blank" rel="noopener noreferrer">{access.portal_url}</a> : <span className="invalid-portal-url">{access.portal_url || "URL não cadastrada"}</span>}<button className="icon-button secret-action" type="button" aria-label="Copiar URL do banco" onClick={() => void navigator.clipboard.writeText(access.portal_url ?? "")}>⧉</button></span></td><td><span className="copyable-cell"><span>{access.login}</span><button className="icon-button secret-action" type="button" aria-label="Copiar login" onClick={() => void navigator.clipboard.writeText(access.login)}>⧉</button></span></td><td><span className="secret-cell"><span>{revealed[access.id] ?? "••••••••••••"}</span><button className="icon-button secret-action" type="button" aria-label={revealed[access.id] ? "Ocultar senha" : "Revelar senha"} onClick={() => void revealPassword(access.id)}>{revealed[access.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button>{revealed[access.id] && <button className="icon-button secret-action" type="button" aria-label="Copiar senha" onClick={() => void copyPassword(access.id)}>⧉</button>}</span></td><td><label className={`expiry-editor expiry-${expiryState(access.password_expires_at)}`}><span>{access.password_expires_at ? `Expira ${new Date(access.password_expires_at).toLocaleDateString("pt-BR")}` : "Definir expiração"}</span><input aria-label={`Data de expiração de ${access.banks?.name ?? "acesso"}`} type="date" value={expiryDrafts[access.id] ?? (access.password_expires_at ? access.password_expires_at.slice(0, 10) : "")} onChange={(event) => setExpiryDrafts((current) => ({ ...current, [access.id]: event.target.value }))} onBlur={(event) => void saveExpiry(access.id, event.target.value)} disabled={savingExpiry === access.id} /></label></td></tr>)}</tbody></table></div></section>}
      <section className="panel data-panel" hidden={view !== "acessos"}><div className="table-toolbar"><div className="table-count"><strong>{filtered.length}</strong> {filtered.length === 1 ? "acesso" : "acessos"}</div><div className="toolbar-actions"><button className="secondary-button" onClick={exportCsv} disabled={!filtered.length}><ArrowDownToLine size={15} /> Exportar CSV</button><Link className="secondary-button" href="/accesses/backup"><FileKey2 size={15} /> Backup</Link></div></div>
        {loading ? <div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando acessos</div> : filtered.length === 0 ? <div className="empty-state"><span className="empty-state-icon"><FileKey2 size={22} /></span><h2>{accesses.length ? "Nenhum acesso encontrado" : "Nenhum acesso cadastrado"}</h2><p>{accesses.length ? "Ajuste os filtros ou a busca." : "Cadastre um acesso para começar a acompanhar as credenciais da loja."}</p>{!accesses.length && banks.length > 0 && <Link className="primary-button" href="/accesses/new"><Plus size={16} /> Cadastrar acesso</Link>}{!accesses.length && banks.length === 0 && <Link className="text-link" href="/banks">Cadastre um banco primeiro <ArrowUpRight size={14} /></Link>}</div> : <div className="table-scroll"><table className="data-table accesses-table"><thead><tr><th>Banco / login</th><th>Senha</th><th>Lojas</th><th>Status</th><th>Última alteração</th><th className="actions-heading">Detalhes</th><th className="actions-heading">Ações</th></tr></thead><tbody>{paginated.map((access) => <tr key={access.id}><td><span className="access-bank-cell">{access.banks?.logo_url ? <Image className="bank-logo" src={access.banks.logo_url} alt="" width={28} height={28} unoptimized /> : <i className="bank-swatch" style={{ background: access.banks?.color ?? "#18264d" }} />}<span><strong>{access.banks?.name ?? "Banco removido"}</strong><small>{access.login}</small></span></span></td><td><span className="secret-cell"><span>{revealed[access.id] ?? "••••••••••••"}</span><button className="icon-button secret-action" title={revealed[access.id] ? "Ocultar senha" : "Revelar senha"} aria-label={revealed[access.id] ? "Ocultar senha" : "Revelar senha"} onClick={() => void revealPassword(access.id)}>{revealed[access.id] ? <EyeOff size={15} /> : <Eye size={15} />}</button><button className="icon-button secret-action" title="Copiar senha" aria-label="Copiar senha" onClick={() => void copyPassword(access.id)}><span className="copy-glyph">⧉</span></button></span></td><td><span className="badge-list">{access.access_stores.length ? access.access_stores.map((link) => link.stores && <span className="team-badge" key={link.store_id}>{link.stores.name}</span>) : <span className="unassigned-badge">Sem loja</span>}</span></td><td><span className={`status-badge status-${access.status}`}><i />{statusLabels[access.status]}</span></td><td><time className="last-change" dateTime={access.updated_at}>{new Date(access.updated_at).toLocaleString("pt-BR")}</time></td><td><Link className="icon-button details-action" href={`/accesses/${access.id}`} aria-label={`Detalhes de ${access.login}`} title="Detalhes"><ArrowUpRight size={17} /></Link></td><td className="fast-edit-cell"><FastEdit access={access} onSaved={(login, status) => { setAccesses((current) => current.map((item) => item.id === access.id ? { ...item, login, status, updated_at: new Date().toISOString() } : item)); }} /></td></tr>)}</tbody></table></div>}
        {pageCount > 1 && <div className="table-pagination"><span>Página {page} de {pageCount}</span><div><button className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Anterior</button><button className="secondary-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Próxima</button></div></div>}
      </section>
    </>

  );
}
