"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Team = { id: string; name: string; responsible: string | null; notes: string | null };
type TeamAccess = { id: string; login: string; status: "active" | "blocked" | "canceled"; banks: { id: string; name: string; color: string } | null };
const statusLabels = { active: "Ativo", blocked: "Bloqueado", canceled: "Cancelado" };

export default function TeamDetail({ id }: { id: string }) {
  const [team, setTeam] = useState<Team | null>(null);
  const [accesses, setAccesses] = useState<TeamAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTeam() {
      const client = createClient();
      const [{ data: teamData, error: teamError }, { data: accessData, error: accessError }] = await Promise.all([
        client.from("teams").select("id,name,responsible,notes").eq("id", id).single(),
        client.from("accesses").select("id,login,status,banks(id,name,color),access_teams!inner(team_id)").eq("access_teams.team_id", id).order("login"),
      ]);
      if (teamError) setError("Equipe não encontrada.");
      else setTeam(teamData as Team);
      if (accessError) setError("Não foi possível carregar os acessos da equipe.");
      else setAccesses((accessData ?? []) as unknown as TeamAccess[]);
      setLoading(false);
    }
    void loadTeam();
  }, [id]);

  const groups = accesses.reduce<Record<string, { name: string; color: string; accesses: TeamAccess[] }>>((result, access) => {
    if (access.banks) {
      result[access.banks.id] ??= { name: access.banks.name, color: access.banks.color, accesses: [] };
      result[access.banks.id].accesses.push(access);
    }
    return result;
  }, {});

  return (
    <>
      <div className="page-heading"><div><Link className="back-link" href="/teams"><ArrowLeft size={15} /> Equipes</Link><span className="eyebrow">EQUIPE</span><h1>{team?.name ?? "Carregando equipe"}</h1><p>{team?.responsible ? `Responsável: ${team.responsible}` : "Acessos bancários vinculados a esta equipe."}</p></div><Link className="secondary-button" href="/teams">Todas as equipes <ArrowUpRight size={14} /></Link></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? <div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando acessos</div> : !accesses.length ? <section className="panel empty-state"><span className="empty-state-icon"><Building2 size={22} /></span><h2>Nenhum acesso vinculado</h2><p>Os acessos associados a esta equipe aparecerão aqui, agrupados por banco.</p><Link className="primary-button" href="/accesses/new">Novo acesso</Link></section> : <div className="team-access-groups">{Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name, "pt-BR")).map(([bankId, group]) => <section className="panel team-bank-group" key={bankId}><div className="team-bank-heading"><span className="bank-swatch" style={{ background: group.color }} /><h2>{group.name}</h2><span>{group.accesses.length} {group.accesses.length === 1 ? "acesso" : "acessos"}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Login</th><th>Status</th><th>Observações</th><th></th></tr></thead><tbody>{group.accesses.map((access) => <tr key={access.id}><td><strong>{access.login}</strong></td><td><span className={`status-badge status-${access.status}`}><i />{statusLabels[access.status]}</span></td><td><span className="muted-cell">Detalhes do acesso</span></td><td><Link className="icon-button" href={`/accesses/${access.id}`} aria-label={`Abrir acesso ${access.login}`}><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div></section>)}</div>}
      {team?.notes && <section className="panel team-notes"><h2>Observações da equipe</h2><p>{team.notes}</p></section>}
    </>
  );
}