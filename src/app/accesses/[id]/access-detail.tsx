"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock3, Copy, Eye, EyeOff, KeyRound, Pencil, Trash2 } from "lucide-react";

type Detail = { id: string; login: string; status: "active" | "blocked" | "canceled"; notes: string | null; created_at: string; updated_at: string; password_changed_at: string | null; banks: { name: string; color: string; portal_url: string | null; logo_url: string | null } | null; access_teams: { team_id: string; teams: { id: string; name: string } | null }[] };
type History = { id: number; changed_at: string; field_name: string; previous_value: string | null; new_value: string | null };
const statusLabels = { active: "Ativo", blocked: "Bloqueado", canceled: "Cancelado" };
const fieldLabels: Record<string, string> = { acesso: "Acesso", bank_id: "Banco", login: "Login", status: "Status", notes: "Observações", equipes: "Equipes", senha: "Senha" };

export default function AccessDetail({ id }: { id: string }) {
  const router = useRouter();
  const [access, setAccess] = useState<Detail | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<"details" | "history">("details");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      const response = await fetch(`/api/accesses?id=${id}`);
      const rows = await response.json().catch(() => []);
      if (cancelled) return;
      if (!response.ok || !rows[0]) setError("Não foi possível carregar este acesso.");
      else setAccess(rows[0] as Detail);
      const auditResponse = await fetch(`/api/audit?entity_id=${id}`);
      const auditRows = await auditResponse.json().catch(() => []);
      if (auditResponse.ok) setHistory((auditRows ?? []).map((row: { id: number; created_at: string; action: string; details: Record<string, unknown> }) => ({ id: row.id, changed_at: row.created_at, field_name: row.action, previous_value: null, new_value: row.details ? JSON.stringify(row.details) : null })));

      setLoading(false);
    }
    void loadDetail();
    return () => { cancelled = true; };
  }, [id]);

  async function reveal() {
    if (visible) { setVisible(false); setPassword(""); return; }
    const response = await fetch("/api/accesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Não foi possível revelar a senha.");
    else { setPassword(data.password); setVisible(true); }
  }

  async function copy() {
    if (!password) {
      const response = await fetch("/api/accesses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error ?? "Não foi possível copiar a senha."); return; }
      await navigator.clipboard.writeText(data.password);
    } else await navigator.clipboard.writeText(password);
  }

  async function deleteAccess() {
    if (!window.confirm("Excluir este acesso e seus vínculos? O histórico existente será preservado.")) return;
    const response = await fetch("/api/accesses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!response.ok) setError("Não foi possível excluir o acesso.");
    else router.replace("/accesses");
  }

  if (loading) return <div className="loading-state">Carregando acesso</div>;
  if (!access) return <div className="panel empty-state"><h2>Acesso não encontrado</h2><Link className="text-link" href="/accesses">Voltar para acessos</Link></div>;

  return (
    <>
      <div className="page-heading detail-heading"><div><Link className="back-link" href="/accesses"><ArrowLeft size={15} /> Acessos</Link><span className="eyebrow">DETALHES DO ACESSO</span><h1 className="detail-title">{access.banks?.logo_url ? <Image className="bank-logo" src={access.banks.logo_url} alt="" width={34} height={34} unoptimized /> : null}{access.banks?.name ?? "Banco"}</h1><p>{access.login}</p></div><div className="heading-actions"><Link className="secondary-button" href={`/accesses/${id}/edit`}><Pencil size={15} /> Editar</Link><button className="icon-button danger-action" title="Excluir acesso" aria-label="Excluir acesso" onClick={() => void deleteAccess()}><Trash2 size={17} /></button></div></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="detail-tabs" role="tablist"><button role="tab" aria-selected={tab === "details"} className={tab === "details" ? "detail-tab-active" : ""} onClick={() => setTab("details")}>Dados do acesso</button><button role="tab" aria-selected={tab === "history"} className={tab === "history" ? "detail-tab-active" : ""} onClick={() => setTab("history")}>Histórico <span>{history.length}</span></button></div>
      {tab === "details" ? <section className="detail-grid"><article className="panel detail-card"><div className="panel-heading"><div><h2>Credenciais</h2><p>Dados de acesso ao portal</p></div><span className={`status-badge status-${access.status}`}><i />{statusLabels[access.status]}</span></div><dl className="detail-list"><div><dt>Banco</dt><dd><span className="access-bank-cell"><i className="bank-swatch" style={{ background: access.banks?.color ?? "#18264d" }} />{access.banks?.name ?? "—"}</span></dd></div>{access.banks?.portal_url && <div><dt>Portal</dt><dd><a className="portal-link" href={access.banks.portal_url} target="_blank" rel="noreferrer">Abrir portal <KeyRound size={13} /></a></dd></div>}<div><dt>Login</dt><dd>{access.login}</dd></div><div><dt>Senha</dt><dd><span className="detail-secret">{visible ? password : "••••••••••••"}<button className="icon-button" title={visible ? "Ocultar senha" : "Revelar senha"} aria-label={visible ? "Ocultar senha" : "Revelar senha"} onClick={() => void reveal()}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button><button className="icon-button" title="Copiar senha" aria-label="Copiar senha" onClick={() => void copy()}><Copy size={15} /></button></span></dd></div><div><dt>Equipes</dt><dd><span className="badge-list">{access.access_teams.length ? access.access_teams.map((link) => link.teams && <Link className="team-badge" key={link.team_id} href={`/teams/${link.team_id}`}>{link.teams.name}</Link>) : <span className="unassigned-badge">Sem equipe</span>}</span></dd></div><div><dt>Criado em</dt><dd>{new Date(access.created_at).toLocaleString("pt-BR")}</dd></div><div><dt>Última alteração</dt><dd>{new Date(access.updated_at).toLocaleString("pt-BR")}</dd></div><div><dt>Última troca de senha</dt><dd>{access.password_changed_at ? new Date(access.password_changed_at).toLocaleString("pt-BR") : "Não registrada"}</dd></div><div><dt>Observações</dt><dd>{access.notes || "Nenhuma observação"}</dd></div></dl></article><article className="panel privacy-panel"><span className="privacy-icon"><Clock3 size={19} /></span><h2>Senha protegida</h2><p>A senha fica criptografada no banco. Revelar e copiar são registrados apenas na interface; o histórico nunca contém seu valor.</p><button className="secondary-button" onClick={() => setTab("history")}>Ver histórico</button></article></section> : <section className="panel history-panel"><div className="panel-heading"><div><h2>Alterações registradas</h2><p>O histórico é automático e não armazena senhas em texto puro.</p></div></div>{history.length ? <ol className="history-list">{history.map((item) => <li key={item.id}><span className="history-marker" /><div><div className="history-title"><strong>{fieldLabels[item.field_name] ?? item.field_name}</strong><time>{new Date(item.changed_at).toLocaleString("pt-BR")}</time></div><p>{item.field_name === "senha" ? "senha alterada" : <><span>{item.previous_value || "(vazio)"}</span><b aria-hidden="true"> → </b><span>{item.new_value || "(vazio)"}</span></>}</p></div></li>)}</ol> : <div className="empty-state compact-empty"><h2>Nenhuma alteração registrada</h2></div>}</section>}
    </>
  );
}
