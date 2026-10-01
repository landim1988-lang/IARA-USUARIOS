"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export default function LoginForm({ configured, notice }: { configured: boolean; notice: string }) {
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
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) throw signInError;
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível entrar. Confira seu e-mail e senha.");
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <a className="brand-lockup" href="/login" aria-label="CREDIPI Controle de Usuários">
          <Image className="brand-logo" src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CREDIPI%20CZAO-Z0aRDJwWLz8KS5CKAPi9GiFotdqivl.jpg" alt="CREDIPI" width={43} height={43} priority />
          <span><strong>CREDIPI</strong><small>CONTROLE DE USUÁRIOS</small></span>
        </a>
        <div className="login-copy">
          <span className="eyebrow">ÁREA RESTRITA</span>
          <h1>Bem-vinda, Iara.</h1>
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
        </form>
        <span className="login-version">CREDIPI · CONTROLE DE USUÁRIOS</span>
      </section>
      <aside className="login-art" aria-label="Identidade visual da CREDIPI">
        <div className="art-orbit art-orbit-one" />
        <div className="art-orbit art-orbit-two" />
        <div className="art-mark art-logo-mark">
          <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/CREDIPI%20CZAO-8svxede8NVqAQKHQTJUjZP4UrkkXrb.jpg" alt="Símbolo CREDIPI" width={220} height={220} priority />
        </div>
        <div className="art-caption"><span>CREDIPI</span><span>CONTROLE COM CONFIANÇA</span></div>
      </aside>
    </main>
  );
}
