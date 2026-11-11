"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type Access = { id: string; bank_id: string; login: string; status: "active" | "blocked" | "canceled" };

export function FastEdit({ access, onSaved }: { access: Access; onSaved: (login: string, status: Access["status"]) => void }) {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(access.login);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(access.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    const response = await fetch("/api/accesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: access.id, bank_id: access.bank_id, login, password: password || undefined, status }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error ?? "Não foi possível salvar.");
    else { onSaved(login, status); setOpen(false); }
    setSaving(false);
  }

  return <span className="fast-edit-wrap"><button className="fast-edit-trigger" type="button" aria-expanded={open} aria-label="Editar login, senha e status" onClick={() => setOpen((value) => !value)}><ChevronDown size={16} aria-hidden="true" /></button>{open && <span className="fast-edit-popover"><strong>Edição rápida</strong><input aria-label="Login" value={login} onChange={(event) => setLogin(event.target.value)} /><input aria-label="Nova senha" type="password" placeholder="Nova senha (opcional)" value={password} onChange={(event) => setPassword(event.target.value)} /><select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value as Access["status"])}><option value="active">Ativo</option><option value="blocked">Bloqueado</option><option value="canceled">Cancelado</option></select>{error && <small>{error}</small>}<span><button type="button" className="primary-button" onClick={() => void save()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button><button type="button" className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button></span></span>}</span>;
}
