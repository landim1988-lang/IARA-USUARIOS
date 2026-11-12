"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { CREDIPI_LOGO_URL } from "@/lib/branding";
import { authClient } from "@/lib/auth-client";

const masterEmail = "usuarios@credipi.com.br";

export default function MasterSetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function setupMaster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice("");
    if (password !== confirmation) { setError("As senhas não coincidem."); return; }
    setBusy(true);
    const response = await fetch("/api/master-setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, name: name.trim(), email: masterEmail, password }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setError(result?.error ?? "Não foi possível criar a conta Master."); setBusy(false); return; }
    const signIn = await authClient.signIn.email({ email: masterEmail, password });
    if (signIn.error) {
      setNotice("Conta Master criada. Entre pela tela de login para continuar.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return <main className="login-page"><section className="login-panel"><div className="brand-lockup"><Image className="brand-logo" src={CREDIPI_LOGO_URL} alt="CREDIPI" width={43} height={43} unoptimized priority /><span><strong>CREDIPI</strong><small>CONTROLE DE USUÁRIOS</small></span></div><div className="login-copy"><span className="eyebrow">CONFIGURAÇÃO INICIAL</span><h1>Criar conta Master</h1><p>Configure a conta principal que poderá cadastrar lojas e administrar usuários.</p></div><form className="login-form" onSubmit={setupMaster}><label htmlFor="master-name">Nome do responsável</label><input id="master-name" required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /><label htmlFor="master-email">E-mail da conta</label><input id="master-email" type="email" value={masterEmail} readOnly /><label htmlFor="setup-token">Token de configuração</label><input id="setup-token" type="password" required autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} /><label htmlFor="master-password">Nova senha</label><input id="master-password" type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><label htmlFor="master-confirm">Confirme a nova senha</label><input id="master-confirm" type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="setup-notice" role="status">{notice}</p>}<button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle size={16} className="spin" /> Criando conta...</> : <><ShieldCheck size={16} /> Criar conta Master</>}</button></form><p className="login-footnote">A configuração só pode ser concluída uma vez.</p></section><aside className="login-art" aria-hidden="true"><div className="art-orbit art-orbit-one" /><div className="art-orbit art-orbit-two" /><span className="art-mark">S</span><div className="art-caption"><span>CREDIPI</span><span>ACESSO SEGURO</span></div></aside></main>;
}
