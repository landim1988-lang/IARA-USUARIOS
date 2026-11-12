"use client";

import { ArrowDownToLine, FileBarChart2 } from "lucide-react";

type ReportAccess = {
  id: string;
  status: "active" | "blocked" | "canceled";
  password_expires_at: string | null;
  access_stores: { store_id: string; stores: { id: string; name: string } | null }[];
};

type StoreOption = { id: string; name: string };
type ReportRow = {
  id: string;
  name: string;
  total: number;
  active: number;
  blocked: number;
  canceled: number;
  overdue: number;
  dueSoon: number;
  noExpiry: number;
};

function daysUntilExpiry(value: string | null) {
  if (!value) return null;
  const today = new Date().toISOString().slice(0, 10);
  const expiryDay = value.slice(0, 10);
  return Math.ceil((Date.parse(`${expiryDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

function csvCell(value: string | number) {
  const text = String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function AccessReport({ accesses, stores, storeFilter }: { accesses: ReportAccess[]; stores: StoreOption[]; storeFilter: string }) {
  const reportStores = stores.filter((store) => !storeFilter || store.id === storeFilter);
  const rows: ReportRow[] = reportStores.map((store) => {
    const storeAccesses = accesses.filter((access) => access.access_stores.some((link) => link.store_id === store.id));
    return {
      id: store.id,
      name: store.name,
      total: storeAccesses.length,
      active: storeAccesses.filter((access) => access.status === "active").length,
      blocked: storeAccesses.filter((access) => access.status === "blocked").length,
      canceled: storeAccesses.filter((access) => access.status === "canceled").length,
      overdue: storeAccesses.filter((access) => {
        const days = daysUntilExpiry(access.password_expires_at);
        return days !== null && days < 0;
      }).length,
      dueSoon: storeAccesses.filter((access) => {
        const days = daysUntilExpiry(access.password_expires_at);
        return days !== null && days >= 0 && days <= 7;
      }).length,
      noExpiry: storeAccesses.filter((access) => !access.password_expires_at).length,
    };
  });
  const unassigned = !storeFilter ? accesses.filter((access) => access.access_stores.length === 0) : [];
  if (unassigned.length) {
    rows.push({
      id: "unassigned",
      name: "Sem loja vinculada",
      total: unassigned.length,
      active: unassigned.filter((access) => access.status === "active").length,
      blocked: unassigned.filter((access) => access.status === "blocked").length,
      canceled: unassigned.filter((access) => access.status === "canceled").length,
      overdue: unassigned.filter((access) => {
        const days = daysUntilExpiry(access.password_expires_at);
        return days !== null && days < 0;
      }).length,
      dueSoon: unassigned.filter((access) => {
        const days = daysUntilExpiry(access.password_expires_at);
        return days !== null && days >= 0 && days <= 7;
      }).length,
      noExpiry: unassigned.filter((access) => !access.password_expires_at).length,
    });
  }

  const activeCount = accesses.filter((access) => access.status === "active").length;
  const overdueCount = accesses.filter((access) => {
    const days = daysUntilExpiry(access.password_expires_at);
    return days !== null && days < 0;
  }).length;
  const dueSoonCount = accesses.filter((access) => {
    const days = daysUntilExpiry(access.password_expires_at);
    return days !== null && days >= 0 && days <= 7;
  }).length;
  const noExpiryCount = accesses.filter((access) => !access.password_expires_at).length;

  function exportReport() {
    const header = ["Loja", "Acessos", "Ativos", "Bloqueados", "Cancelados", "Senhas vencidas", "Vencem em até 7 dias", "Sem previsão"];
    const rowsToExport = rows.map((row) => [row.name, row.total, row.active, row.blocked, row.canceled, row.overdue, row.dueSoon, row.noExpiry]);
    const totalRow = ["Total geral (acessos únicos)", accesses.length, activeCount, accesses.filter((access) => access.status === "blocked").length, accesses.filter((access) => access.status === "canceled").length, overdueCount, dueSoonCount, noExpiryCount];
    const csv = [header, ...rowsToExport, totalRow].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "credipi-relatorio-acessos.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <section className="panel data-panel report-panel" aria-labelledby="access-report-title">
      <div className="table-toolbar report-toolbar">
        <div><h2 id="access-report-title"><FileBarChart2 size={17} aria-hidden="true" /> Relatório por loja</h2><p>Resumo calculado com os filtros ativos.</p></div>
        <button className="secondary-button" type="button" onClick={exportReport} disabled={!accesses.length}>
          <ArrowDownToLine size={15} aria-hidden="true" /> Exportar relatório CSV
        </button>
      </div>
      <dl className="report-summary-grid">
        <div><dt>Acessos filtrados</dt><dd>{accesses.length}</dd></div>
        <div><dt>Ativos</dt><dd>{activeCount}</dd></div>
        <div><dt>Senhas vencidas</dt><dd>{overdueCount}</dd></div>
        <div><dt>Vencem em até 7 dias</dt><dd>{dueSoonCount}</dd></div>
        <div><dt>Sem previsão</dt><dd>{noExpiryCount}</dd></div>
      </dl>
      <div className="table-scroll">
        <table className="data-table report-table">
          <caption className="sr-only">Quantidade de acessos e situação das senhas por loja</caption>
          <thead><tr><th>Loja</th><th>Acessos</th><th>Ativos</th><th>Bloqueados</th><th>Cancelados</th><th>Vencidas</th><th>Até 7 dias</th><th>Sem previsão</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.total}</td><td>{row.active}</td><td>{row.blocked}</td><td>{row.canceled}</td><td>{row.overdue}</td><td>{row.dueSoon}</td><td>{row.noExpiry}</td></tr>) : <tr><td colSpan={8}>Nenhuma loja corresponde aos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="report-note">O relatório não inclui senhas. Acessos compartilhados entre lojas aparecem em cada loja; o total geral conta cada acesso uma única vez.</p>
    </section>
  );
}
