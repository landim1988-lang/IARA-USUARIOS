"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Download, FileKey2, LockKeyhole, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const iterations = 310_000;
const encoder = new TextEncoder();

function base64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export default function BackupPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function createEncryptedBackup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);
    if (password.length < 12) { setError("Use uma senha de backup com pelo menos 12 caracteres."); return; }
    if (password !== confirmation) { setError("As senhas de backup não coincidem."); return; }
    setBusy(true);

    try {
      const client = createClient();
      const [{ data: banks, error: banksError }, { data: teams, error: teamsError }, { data: accesses, error: accessesError }, { data: accessTeams, error: linksError }, { data: history, error: historyError }] = await Promise.all([
        client.from("banks").select("*"),
        client.from("teams").select("*"),
        client.from("accesses").select("*"),
        client.from("access_teams").select("*"),
        client.from("access_history").select("*"),
      ]);
      const queryError = banksError || teamsError || accessesError || linksError || historyError;
      if (queryError) throw new Error("Não foi possível ler todos os dados do Supabase.");

      const credentials = await Promise.all((accesses ?? []).map(async (access) => {
        const { data, error: secretError } = await client.rpc("reveal_access_password", { p_access_id: access.id });
        if (secretError && !secretError.message.includes("Senha não cadastrada")) throw new Error("Não foi possível incluir todas as senhas. Verifique a chave do Vault.");
        return { access_id: access.id, password: data ?? null };
      }));
      const payload = JSON.stringify({ version: 1, exported_at: new Date().toISOString(), banks, teams, accesses, access_teams: accessTeams, access_history: history, credentials });
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
      const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
      const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(payload));
      const file = { format: "stilo-encrypted-backup", version: 1, kdf: "PBKDF2-SHA-256", iterations, cipher: "AES-256-GCM", salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext)) };
      const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `stilo-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao gerar o backup criptografado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-heading"><div><Link className="back-link" href="/accesses"><ArrowLeft size={15} /> Acessos</Link><span className="eyebrow">PROTEÇÃO DE DADOS</span><h1>Backup criptografado</h1><p>Gere um arquivo completo protegido por uma senha definida agora.</p></div></div>
      <section className="backup-layout"><article className="panel backup-form-panel"><span className="backup-icon"><FileKey2 size={21} /></span><h2>Proteger arquivo</h2><p>O arquivo inclui bancos, equipes, vínculos, acessos, histórico e senhas. A criptografia é aplicada no navegador com AES-256-GCM.</p><form className="form-grid" onSubmit={createEncryptedBackup}><label className="field-span">Senha do backup<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="field-span">Confirme a senha<input type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{error && <p className="inline-error field-span" role="alert">{error}</p>}{success && <p className="success-notice field-span">Backup criptografado gerado. Guarde a senha em local seguro; ela não pode ser recuperada.</p>}<div className="modal-actions field-span"><button type="submit" className="primary-button" disabled={busy}>{busy ? "Criptografando..." : <><Download size={16} /> Gerar backup</>}</button></div></form></article><aside className="backup-notes"><div><LockKeyhole size={18} /><span><strong>Senha não recuperável</strong><small>Sem a senha definida aqui, não será possível abrir o arquivo.</small></span></div><div><ShieldCheck size={18} /><span><strong>Proteção local</strong><small>Os dados são criptografados no navegador antes de baixar.</small></span></div></aside></section>
    </>
  );
}