"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Banknote, Building2, Clock3, LoaderCircle, Plus, Users } from "lucide-react";

type DashboardAccess = { id: string; status: string; password_changed_at: string | null; banks: { id: string; name: string; color: string } | null; access_teams: { team_id: string; teams: { id: string; name: string } | null }[] };
type DashboardTeam = { id: string; name: string };
const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const [accesses, setAccesses] = useState<DashboardAccess[]>([]);
  const [teams, setTeams] = useState<DashboardTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const [accessResponse, teamResponse] = await Promise.all([fetch("/api/accesses"), fetch("/api/data?table=teams")]);
      const [accessData, teamData] = await Promise.all([accessResponse.json(), teamResponse.json()]);
      if (!accessResponse.ok || !teamResponse.ok) setError("Não foi possível carregar os indicadores do Neon.");
      else {
        setAccesses((accessData ?? []).map((row: Record<string, unknown>) => ({
          ...row,
          banks: row.bank_name ? { id: row.bank_id_ref, name: row.bank_name, color: row.bank_color } : null,
          access_teams: Array.isArray(row.access_teams) ? row.access_teams : [],
        })) as DashboardAccess[]);
        setTeams((teamData ?? []) as DashboardTeam[]);
      }
      setLoading(false);
    }
    void loadDashboard();
  }, []);

  const activeCount = accesses.filter((access) => access.status === "active").length;
  const blockedCount = accesses.filter((access) => access.status === "blocked").length;
  const canceledCount = accesses.filter((access) => access.status === "canceled").length;
  const noTeamCount = accesses.filter((access) => access.access_teams.length === 0).length;
  const staleCount = accesses.filter((access) => !access.password_changed_at || new Date(access.password_changed_at).getTime() < ninetyDaysAgo).length;
  const bankCounts = accesses.reduce<Record<string, { name: string; color: string; count: number }>>((counts, access) => {
    if (access.banks) {
      counts[access.banks.id] ??= { name: access.banks.name, color: access.banks.color, count: 0 };
      counts[access.banks.id].count += 1;
    }
    return counts;
  }, {});
  const bankRows = Object.values(bankCounts).sort((first, second) => second.count - first.count);
  const teamCounts = teams.map((team) => ({ ...team, count: accesses.filter((access) => access.access_teams.some((link) => link.team_id === team.id)).length }));
  const totalStatuses = activeCount + blockedCount + canceledCount;
  const donut = totalStatuses ? `conic-gradient(#20a46b 0 ${activeCount / totalStatuses * 100}%, #eaa13a ${activeCount / totalStatuses * 100}% ${(activeCount + blockedCount) / totalStatuses * 100}%, #a6adbb ${(activeCount + blockedCount) / totalStatuses * 100}% 100%)` : undefined;
  const maxBankCount = Math.max(1, ...bankRows.map((bank) => bank.count));
  const maxTeamCount = Math.max(1, ...teamCounts.map((team) => team.count));

  return (
    <>
      <div className="page-heading">
        <div><span className="eyebrow">GESTÃO</span><h1>Visão geral</h1><p>Acompanhe os acessos bancários e a operação da sua equipe.</p></div>
        <Link className="primary-button" href="/accesses/new"><Plus size={17} /> Novo acesso</Link>
      </div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <section className="metrics-grid" aria-label="Resumo">
        {[
          { label: "Acessos cadastrados", value: accesses.length, note: "Total de logins", icon: Banknote, tone: "orange" },
          { label: "Acessos ativos", value: activeCount, note: "Disponíveis para uso", icon: Building2, tone: "green" },
          { label: "Bloqueados", value: blockedCount, note: "Precisam de acompanhamento", icon: Clock3, tone: "slate" },
          { label: "Sem equipe vinculada", value: noTeamCount, note: "Atribua uma equipe", icon: Users, tone: "navy" },
        ].map(({ label, value, note, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon metric-icon-${tone}`}><Icon size={17} /></span></div>
            <div className="metric-value">{loading ? <LoaderCircle size={22} className="spin" /> : value}</div><div className="metric-note">{note}</div>
          </article>
        ))}
      </section>
      <section className="overview-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><h2>Acessos por banco</h2><p>Distribuição dos logins cadastrados</p></div><Link href="/banks" className="subtle-link">Ver bancos <ArrowUpRight size={15} /></Link></div>
          {bankRows.length ? <div className="bar-chart">{bankRows.map((bank) => <div className="bar-row" key={bank.name}><span>{bank.name}</span><i><b style={{ width: `${bank.count / maxBankCount * 100}%`, background: bank.color }} /></i><strong>{bank.count}</strong></div>)}</div> : <div className="empty-chart"><div className="chart-grid-lines"><span /><span /><span /><span /></div><div className="empty-chart-content"><span className="empty-chart-icon"><Building2 size={22} /></span><strong>{loading ? "Carregando dados" : "Nenhum acesso cadastrado"}</strong><span>{loading ? "" : "Cadastre um banco e um acesso para visualizar os indicadores."}</span>{!loading && <Link href="/banks" className="text-link">Cadastrar primeiro banco <ArrowUpRight size={14} /></Link>}</div></div>}
        </article>
        <article className="panel status-panel">
          <div className="panel-heading"><div><h2>Status dos acessos</h2><p>Ativos, bloqueados e cancelados</p></div></div>
          <div className="status-empty"><div className="status-ring" style={{ background: donut }}><span>{loading ? "…" : totalStatuses}</span></div><span>{totalStatuses ? "Acessos por situação" : loading ? "Carregando" : "Sem dados para exibir"}</span></div>
          <div className="status-legend"><span><i className="legend-dot legend-active" />Ativos <b>{loading ? "—" : activeCount}</b></span><span><i className="legend-dot legend-blocked" />Bloqueados <b>{loading ? "—" : blockedCount}</b></span><span><i className="legend-dot legend-canceled" />Cancelados <b>{loading ? "—" : canceledCount}</b></span></div>
        </article>
      </section>
      <section className="bottom-grid">
        <article className="panel team-panel">
          <div className="panel-heading"><div><h2>Acessos por equipe</h2><p>Visão das equipes cadastradas</p></div><Link href="/teams" className="subtle-link">Ver equipes <ArrowUpRight size={15} /></Link></div>
          {teamCounts.map((team, index) => <div className="team-row" key={team.id}><span className={`team-initial ${index % 2 ? "team-initial-blue" : "team-initial-orange"}`}>{team.name.slice(0, 1).toUpperCase()}</span><Link href={`/teams/${team.id}`} className="team-name">{team.name}</Link><span className="team-count">{loading ? "—" : `${team.count} acessos`}</span><span className="team-track"><i style={{ width: `${team.count / maxTeamCount * 100}%` }} /></span></div>)}
          {!loading && !teamCounts.length && <div className="dashboard-empty-line">Cadastre uma equipe para organizar os acessos.</div>}
        </article>
        <article className="panel attention-panel">
          <div className="panel-heading"><div><h2>Atenção necessária</h2><p>Itens para acompanhar</p></div></div>
          <div className="attention-item"><span className="attention-mark attention-orange"><Clock3 size={16} /></span><span><strong>Troca de senha</strong><small>Sem troca há mais de 90 dias</small></span><b>{loading ? "—" : staleCount}</b></div>
          <div className="attention-item"><span className="attention-mark attention-blue"><Users size={16} /></span><span><strong>Sem equipe vinculada</strong><small>Acessos sem equipe responsável</small></span><b>{loading ? "—" : noTeamCount}</b></div>
        </article>
      </section>
    </>
  );
}
