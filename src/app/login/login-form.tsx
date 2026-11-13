"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { CREDIPI_LOGO_URL } from "@/lib/branding";

export default function LoginForm({ configured, notice, masterSetupAvailable }: { configured: boolean; notice: string; masterSetupAvailable: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (signInError) {
        setError(
          signInError.code === "INVALID_ORIGIN"
            ? "Este endereço não está autorizado para login. Atualize a página e tente novamente."
            : "Não foi possível entrar. Confira seu e-mail e senha.",
        );
        setLoading(false);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <a className="brand-lockup" href="/login" aria-label="CREDIPI Controle de Usuários">
          <Image className="brand-logo" src={CREDIPI_LOGO_URL} alt="CREDIPI" width={43} height={43} style={{ width: "43px", height: "43px" }} unoptimized priority />
          <span><strong>CREDIPI</strong><small>CONTROLE DE USUÁRIOS</small></span>
        </a>
        <div className="login-copy">
          <span className="eyebrow">ÁREA RESTRITA</span>
          <h1>Bem-vindo.</h1>
          <p>Esse é seu controle de usuários e senhas.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={!configured} />
          <label htmlFor="password">Senha</label>
          <div className="password-input">
            <input id="password" type={visible ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={!configured} />
            <button type="button" className="icon-button" aria-label={visible ? "Ocultar senha" : "Revelar senha"} onClick={() => setVisible((current) => !current)}>
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {notice && <p className="setup-notice" role="status"><LockKeyhole size={16} /> {notice}</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {!configured && <p className="setup-notice"><LockKeyhole size={16} /> Configure o banco online para habilitar o acesso.</p>}
          <button className="primary-button login-submit" type="submit" disabled={!configured || loading}>
            {loading ? "Entrando..." : "Entrar"}<ArrowRight size={17} />
          </button>
          <p className="login-footnote">Acesso exclusivo. Novas contas são criadas pelo administrador.</p>
          {masterSetupAvailable && <Link className="login-footnote" href="/master-setup">Configuração inicial da conta Master</Link>}
        </form>
        <span className="login-version">CREDIPI · CONTROLE DE USUÁRIOS</span>
      </section>
      <aside className="login-art" aria-label="Identidade visual da CREDIPI">
        <div className="art-orbit art-orbit-one" />
        <div className="art-orbit art-orbit-two" />
        <div className="art-mark art-logo-mark"><Image src={CREDIPI_LOGO_URL} alt="Símbolo CREDIPI" width={220} height={220} style={{ width: "220px", height: "220px" }} unoptimized priority /></div>
        <div className="art-caption"><span>CREDIPI</span><span>CONTROLE COM CONFIANÇA</span></div>
      </aside>
    </main>
  );
}
