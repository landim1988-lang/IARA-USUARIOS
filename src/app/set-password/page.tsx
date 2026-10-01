"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 12) { setError("Use pelo menos 12 caracteres."); return; }
    if (password !== confirmation) { setError("As senhas não coincidem."); return; }
    setSaving(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    if (updateError) {
      setError("Não foi possível definir a senha. Reabra o convite mais recente do Supabase.");
      setSaving(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <a className="brand-lockup" href="/login" aria-label="Stilo Controle de Usuários"><Image className="brand-logo" src="/stilo-logo.png.jpeg" alt="Stilo" width={43} height={43} priority /><span><strong>stilo</strong><small>CONTROLE DE USUÁRIOS</small></span></a>
        <div className="login-copy"><span className="eyebrow">PRIMEIRO ACESSO</span><h1>Defina sua<br />senha.</h1><p>Crie uma senha exclusiva para acessar o controle de usuários da Stilo.</p></div>
        <form className="login-form" onSubmit={savePassword}>
          <label htmlFor="new-password">Nova senha</label>
          <div className="password-input"><input id="new-password" type={visible ? "text" : "password"} minLength={12} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="icon-button" aria-label={visible ? "Ocultar senha" : "Revelar senha"} onClick={() => setVisible((current) => !current)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <label htmlFor="confirm-password">Confirme a senha</label><input id="confirm-password" type={visible ? "text" : "password"} minLength={12} autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button login-submit" type="submit" disabled={saving}>{saving ? "Salvando..." : <>Salvar senha <ArrowRight size={17} /></>}</button>
          <p className="login-footnote"><KeyRound size={13} /> Use uma senha forte, exclusiva e guarde-a em local seguro.</p>
        </form>
        <span className="login-version">STILO · CREDIPI</span>
      </section>
      <aside className="login-art" aria-label="Identidade visual da Stilo"><div className="art-orbit art-orbit-one" /><div className="art-orbit art-orbit-two" /><div className="art-mark">$</div><div className="art-caption"><span>STILO</span><span>CONTROLE COM CONFIANÇA</span></div></aside>
    </main>
  );
}