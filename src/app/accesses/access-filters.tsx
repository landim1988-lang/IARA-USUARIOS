"use client";

import { Filter, RotateCcw, Search } from "lucide-react";

type BankOption = { id: string; name: string };
type StoreOption = { id: string; name: string };
type ExpiryFilter = "all" | "expired" | "next7" | "none";

type AccessFiltersProps = {
  resultCount: number;
  search: string;
  bankFilter: string;
  storeFilter: string;
  statusFilter: string;
  createdFrom: string;
  createdTo: string;
  expiryFilter: ExpiryFilter;
  banks: BankOption[];
  stores: StoreOption[];
  onSearchChange: (value: string) => void;
  onBankChange: (value: string) => void;
  onStoreChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onExpiryChange: (value: ExpiryFilter) => void;
  onClear: () => void;
};

const statusOptions = [
  { value: "active", label: "Ativo" },
  { value: "blocked", label: "Bloqueado" },
  { value: "canceled", label: "Cancelado" },
];

export function AccessFilters({
  resultCount,
  search,
  bankFilter,
  storeFilter,
  statusFilter,
  createdFrom,
  createdTo,
  expiryFilter,
  banks,
  stores,
  onSearchChange,
  onBankChange,
  onStoreChange,
  onStatusChange,
  onCreatedFromChange,
  onCreatedToChange,
  onExpiryChange,
  onClear,
}: AccessFiltersProps) {
  const hasFilters = Boolean(search || bankFilter || storeFilter || statusFilter || createdFrom || createdTo || expiryFilter !== "all");

  return (
    <section className="panel data-panel access-filters-panel" aria-label="Filtros dos acessos">
      <div className="table-toolbar access-filter-toolbar">
        <div className="table-count"><strong>{resultCount}</strong> {resultCount === 1 ? "acesso encontrado" : "acessos encontrados"}</div>
        <div className="access-filter-actions">
          <label className="search-field">
            <Search size={16} aria-hidden="true" />
            <input aria-label="Buscar por login, banco ou loja" placeholder="Buscar login, banco ou loja" value={search} onChange={(event) => onSearchChange(event.target.value)} />
          </label>
          <button className="secondary-button" type="button" onClick={onClear} disabled={!hasFilters}>
            <RotateCcw size={14} aria-hidden="true" /> Limpar filtros
          </button>
        </div>
      </div>
      <div className="filter-row access-filter-row">
        <span><Filter size={14} aria-hidden="true" />Filtros</span>
        <select aria-label="Filtrar por banco" value={bankFilter} onChange={(event) => onBankChange(event.target.value)}>
          <option value="">Todos os bancos</option>
          {banks.map((bank) => <option key={bank.id} value={bank.id}>{bank.name}</option>)}
        </select>
        <select aria-label="Filtrar por loja" value={storeFilter} onChange={(event) => onStoreChange(event.target.value)}>
          <option value="">Todas as lojas</option>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
        </select>
        <select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">Todos os status</option>
          {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
        <label className="date-filter">
          <span>Cadastro desde</span>
          <input aria-label="Data inicial do cadastro" type="date" value={createdFrom} max={createdTo || undefined} onChange={(event) => onCreatedFromChange(event.target.value)} />
        </label>
        <label className="date-filter">
          <span>Cadastro até</span>
          <input aria-label="Data final do cadastro" type="date" value={createdTo} min={createdFrom || undefined} onChange={(event) => onCreatedToChange(event.target.value)} />
        </label>
        <select aria-label="Filtrar por vencimento de senha" value={expiryFilter} onChange={(event) => onExpiryChange(event.target.value as ExpiryFilter)}>
          <option value="all">Todos os vencimentos</option>
          <option value="expired">Senhas vencidas</option>
          <option value="next7">Vencem em até 7 dias</option>
          <option value="none">Sem previsão</option>
        </select>
      </div>
    </section>
  );
}
