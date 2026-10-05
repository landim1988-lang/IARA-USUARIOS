"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";

type Bank = { id: string; name: string; is_active: boolean };
type Access = { id: string; bank_id: string; login: string; status: string; notes: string | null; cpf_titular: string | null };
const statusOptions = [{ value: "active", label: "Ativo" }, { value: "blocked", label: "Bloqueado" }, { value: "canceled", label: "Cancelado" }];
export default function AccessForm({ accessId }: { accessId?: string }) {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankId, setBankId] = useState("");
  const [login, setLogin] = useState("");
  const [cpfTitular, setCpfTitular] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadForm() {
      const bankResponse = await fetch("/api/data?table=banks");
      const bankData = await bankResponse.json();
      if (!bankResponse.ok) setError("Não foi possível carregar os bancos do Neon.");
      setBanks((bankData ?? []) as Bank[]);
      if (accessId) {
        const response = await fetch(`/api/accesses?id=${accessId}`);
        const data = await response.json();
        const access = data?.[0] as Access | undefined;
        if (!response.ok || !access) setError("Não foi possível localizar este acesso.");
        else { setBankId(access.bank_id); setLogin(access.login); setCpfTitular(access.cpf_titular ?? ""); setStatus(access.status); setNotes(access.notes ?? ""); }
      }
      setLoading(false);
    }
    void loadForm();
  }, [accessId]);

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    let response: Response;
    try {
      response = await fetch("/api/accesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: accessId, bank_id: bankId, login: login.trim(), cpf_titular: cpfTitular.trim(), status, notes: notes.trim(), password: password || undefined }) });
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
      setSaving(false);
      return;
    }
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setError(result?.error ?? "Não foi possível salvar. Verifique os dados e tente novamente.");
      setSaving(false);
      return;
    }
    router.replace("/accesses");
  }

  if (loading) return <div className="loading-state"><span className="spin">◌</span> Carregando formulário</div>;

  return (
    <>
      <div className="page-heading"><div><Link className="back-link" href={accessId ? `/accesses/${accessId}` : "/accesses"}><ArrowLeft size={15} /> Voltar</Link><span className="eyebrow">ACESSO BANCÁRIO</span><h1>{accessId ? "Editar acesso" : "Novo acesso"}</h1><p>As senhas são criptografadas e não aparecem no histórico de alterações.</p></div></div>
      <nav className="access-tabs" aria-label="Seções de acessos"><Link className="access-tab" href="/accesses">Acessos cadastrados</Link><Link className="access-tab access-tab-active" href="/accesses/new">Cadastrar acessos</Link></nav>
      <form className="panel access-form" onSubmit={saveAccess}>
        <div className="form-section"><div className="form-section-heading"><span>01</span><div><h2>Identificação</h2><p>Informe o banco e o usuário de acesso.</p></div></div><div className="form-grid"><label>Banco<select required value={bankId} onChange={(event) => setBankId(event.target.value)}><option value="">Selecione um banco</option>{banks.map((bank) => <option key={bank.id} value={bank.id} disabled={!bank.is_active}>{bank.name}{bank.is_active ? "" : " (inativo)"}</option>)}</select></label><label>Login<input required maxLength={160} autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} /></label><label>CPF do titular (opcional)<input maxLength={14} inputMode="numeric" placeholder="000.000.000-00" value={cpfTitular} onChange={(event) => setCpfTitular(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field-span">Observações<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div></div>
        <div className="form-section"><div className="form-section-heading"><span>02</span><div><h2>Senha do portal</h2><p>{accessId ? "Deixe em branco para manter a senha atual." : "A senha será cifrada antes de ser armazenada."}</p></div></div><div className="form-grid"><label className="field-span">{accessId ? "Nova senha (opcional)" : "Senha"}<span className="password-entry"><input type={passwordVisible ? "text" : "password"} autoComplete="new-password" required={!accessId} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="icon-button" aria-label={passwordVisible ? "Ocultar senha" : "Revelar senha"} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label></div><p className="security-note"><ShieldCheck size={16} /> Senhas são criptografadas no banco. O histórico registra somente “senha alterada”.</p></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="form-footer"><Link className="secondary-button" href={accessId ? `/accesses/${accessId}` : "/accesses"}>Cancelar</Link><button className="primary-button" type="submit" disabled={saving || banks.length === 0 || !bankId}>{saving ? "Salvando..." : <><KeyRound size={16} /> {accessId ? "Salvar alterações" : "Cadastrar acesso"}</>}</button></div>
      </form>
    </>
  );
}
