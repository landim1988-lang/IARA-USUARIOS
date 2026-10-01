"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Bank = { id: string; name: string; is_active: boolean };
type Team = { id: string; name: string };
type Access = { id: string; bank_id: string; login: string; status: string; notes: string | null };
const statusOptions = [{ value: "active", label: "Ativo" }, { value: "blocked", label: "Bloqueado" }, { value: "canceled", label: "Cancelado" }];
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-";

function makePassword() {
  const values = new Uint32Array(20);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export default function AccessForm({ accessId }: { accessId?: string }) {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [bankId, setBankId] = useState("");
  const [login, setLogin] = useState("");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadForm() {
      const client = createClient();
      const [{ data: bankData, error: bankError }, { data: teamData, error: teamError }] = await Promise.all([
        client.from("banks").select("id,name,is_active").order("name"),
        client.from("teams").select("id,name").order("name"),
      ]);
      if (bankError || teamError) setError("Não foi possível carregar os cadastros do Supabase.");
      setBanks((bankData ?? []) as Bank[]);
      setTeams((teamData ?? []) as Team[]);
      if (accessId) {
        const { data, error: accessError } = await client.from("accesses").select("id,bank_id,login,status,notes,access_teams(team_id)").eq("id", accessId).single();
        if (accessError || !data) setError("Não foi possível localizar este acesso.");
        else {
          const access = data as unknown as Access & { access_teams: { team_id: string }[] };
          setBankId(access.bank_id);
          setLogin(access.login);
          setStatus(access.status);
          setNotes(access.notes ?? "");
          setTeamIds(access.access_teams.map((link) => link.team_id));
        }
      }
      setLoading(false);
    }
    void loadForm();
  }, [accessId]);

  const strength = password.length === 0 ? 0 : Math.min(5, Number(password.length >= 10) + Number(password.length >= 16) + Number(/[a-z]/.test(password) && /[A-Z]/.test(password)) + Number(/\d/.test(password)) + Number(/[^A-Za-z0-9]/.test(password)));
  const strengthLabel = ["", "Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"][strength];

  function toggleTeam(id: string) {
    setTeamIds((current) => current.includes(id) ? current.filter((teamId) => teamId !== id) : [...current, id]);
  }

  async function saveAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const { error: saveError } = await createClient().rpc("save_access", {
      p_access_id: accessId ?? null,
      p_bank_id: bankId,
      p_login: login.trim(),
      p_status: status,
      p_notes: notes.trim() || null,
      p_team_ids: teamIds,
      p_password: password || null,
    });
    if (saveError) {
      setError(saveError.code === "23505" ? "Este login já está cadastrado neste banco." : saveError.message.includes("Vault") ? "A chave do Vault ainda não foi configurada no Supabase." : "Não foi possível salvar. Verifique os dados e tente novamente.");
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
        <div className="form-section"><div className="form-section-heading"><span>01</span><div><h2>Identificação</h2><p>Informe o banco e o usuário de acesso.</p></div></div><div className="form-grid"><label>Banco<select required value={bankId} onChange={(event) => setBankId(event.target.value)}><option value="">Selecione um banco</option>{banks.map((bank) => <option key={bank.id} value={bank.id} disabled={!bank.is_active}>{bank.name}{bank.is_active ? "" : " (inativo)"}</option>)}</select></label><label>Login<input required maxLength={160} autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} /></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="field-span">Observações<textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} /></label></div></div>
        <div className="form-section"><div className="form-section-heading"><span>02</span><div><h2>Senha do portal</h2><p>{accessId ? "Deixe em branco para manter a senha atual." : "A senha será cifrada antes de ser armazenada."}</p></div></div><div className="form-grid"><label className="field-span">{accessId ? "Nova senha (opcional)" : "Senha"}<span className="password-entry"><input type={passwordVisible ? "text" : "password"} autoComplete="new-password" required={!accessId} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="icon-button" aria-label={passwordVisible ? "Ocultar senha" : "Revelar senha"} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}</button><button type="button" className="secondary-button generator-button" onClick={() => setPassword(makePassword())}><RefreshCw size={14} /> Gerar senha</button></span>{password && <span className={`strength-indicator strength-${strength}`}><i><b style={{ width: `${strength * 20}%` }} /></i><span>{strengthLabel}</span></span>}</label></div><p className="security-note"><ShieldCheck size={16} /> Senhas são criptografadas no banco. O histórico registra somente “senha alterada”.</p></div>
        <div className="form-section"><div className="form-section-heading"><span>03</span><div><h2>Equipes com acesso</h2><p>Selecione uma ou mais equipes responsáveis.</p></div></div><div className="team-picker">{teams.length === 0 ? <p className="muted-cell">Cadastre uma equipe antes de continuar.</p> : teams.map((team) => <label className={`team-option ${teamIds.includes(team.id) ? "team-option-selected" : ""}`} key={team.id}><input type="checkbox" checked={teamIds.includes(team.id)} onChange={() => toggleTeam(team.id)} /><span className="team-initial team-initial-orange">{team.name.slice(0, 1).toUpperCase()}</span><span>{team.name}</span></label>)}</div></div>
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="form-footer"><Link className="secondary-button" href={accessId ? `/accesses/${accessId}` : "/accesses"}>Cancelar</Link><button className="primary-button" type="submit" disabled={saving || banks.length === 0 || !bankId}>{saving ? "Salvando..." : <><KeyRound size={16} /> {accessId ? "Salvar alterações" : "Cadastrar acesso"}</>}</button></div>
      </form>
    </>
  );
}