"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, LoaderCircle } from "lucide-react";

type Store = { id: string; name: string; responsible: string | null; notes: string | null };
type StoreAccess = { id: string; login: string; status: "active" | "blocked" | "canceled"; banks: { id: string; name: string; color: string } | null };
const statusLabels = { active: "Ativo", blocked: "Bloqueado", canceled: "Cancelado" };

export default function StoreDetail({ id }: { id: string }) {
  const [store, setStore] = useState<Store | null>(null);
  const [accesses, setAccesses] = useState<StoreAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadStore() {
      const [storeResponse, accessResponse] = await Promise.all([fetch("/api/data?table=stores"), fetch("/api/accesses")]);
      const [storeData, accessData] = await Promise.all([storeResponse.json().catch(() => []), accessResponse.json().catch(() => [])]);
      if (cancelled) return;
      const selectedStore = (storeData ?? []).find((item: Store) => item.id === id);
      const linkedAccesses = (accessData ?? []).filter((access: { access_stores?: { store_id: string }[] }) => access.access_stores?.some((link) => link.store_id === id));
      if (!storeResponse.ok || !selectedStore) setError("Loja não encontrada.");
      else setStore(selectedStore as Store);
      if (!accessResponse.ok) setError("Não foi possível carregar os acessos da loja.");
      else setAccesses(linkedAccesses as StoreAccess[]);
      setLoading(false);
    }
    void loadStore();
    return () => { cancelled = true; };
  }, [id]);

  const groups = accesses.reduce<Record<string, { name: string; color: string; accesses: StoreAccess[] }>>((result, access) => {
    if (access.banks) {
      result[access.banks.id] ??= { name: access.banks.name, color: access.banks.color, accesses: [] };
      result[access.banks.id].accesses.push(access);
    }
    return result;
  }, {});

  return (
    <>
      <div className="page-heading"><div><Link className="back-link" href="/teams"><ArrowLeft size={15} /> Lojas</Link><span className="eyebrow">LOJA</span><h1>{store?.name ?? "Carregando loja"}</h1><p>{store?.responsible ? `Responsável: ${store.responsible}` : "Acessos bancários vinculados a esta loja."}</p></div><Link className="secondary-button" href="/teams">Todas as lojas <ArrowUpRight size={14} /></Link></div>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? <div className="loading-state"><LoaderCircle size={19} className="spin" /> Carregando acessos</div> : !accesses.length ? <section className="panel empty-state"><span className="empty-state-icon"><Building2 size={22} /></span><h2>Nenhum acesso vinculado</h2><p>Os acessos associados a esta loja aparecerão aqui, agrupados por banco.</p><Link className="primary-button" href="/accesses/new">Novo acesso</Link></section> : <div className="team-access-groups">{Object.entries(groups).sort((a, b) => a[1].name.localeCompare(b[1].name, "pt-BR")).map(([bankId, group]) => <section className="panel team-bank-group" key={bankId}><div className="team-bank-heading"><span className="bank-swatch" style={{ background: group.color }} /><h2>{group.name}</h2><span>{group.accesses.length} {group.accesses.length === 1 ? "acesso" : "acessos"}</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Login</th><th>Status</th><th>Observações</th><th></th></tr></thead><tbody>{group.accesses.map((access) => <tr key={access.id}><td><strong>{access.login}</strong></td><td><span className={`status-badge status-${access.status}`}><i />{statusLabels[access.status]}</span></td><td><span className="muted-cell">Detalhes do acesso</span></td><td><Link className="icon-button" href={`/accesses/${access.id}`} aria-label={`Abrir acesso ${access.login}`}><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div></section>)}</div>}
      {store?.notes && <section className="panel team-notes"><h2>Observações da loja</h2><p>{store.notes}</p></section>}
    </>
  );
}
