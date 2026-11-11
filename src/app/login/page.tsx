import { pool } from "@/lib/access-control";
import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ setup?: string; unauthorized?: string; expired?: string; invite?: string }> }) {
  const params = await searchParams;
  const configured = Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
  let masterSetupAvailable = false;
  if (configured && process.env.MASTER_SETUP_TOKEN) {
    try {
      const result = await pool.query('select 1 from public."user" where role = \'master\' limit 1');
      masterSetupAvailable = !result.rows[0];
    } catch {
      masterSetupAvailable = false;
    }
  }
  const notice = params.expired
    ? "Sua sessão foi encerrada após 15 minutos de inatividade. Entre novamente."
    : params.unauthorized
      ? "Esta conta não está autorizada para administrar o sistema."
      : params.setup
        ? "Finalize a configuração do banco online e autorize a conta administradora."
        : params.invite
          ? "O convite não é válido ou expirou. Peça um novo convite ao administrador."
        : "";

  return <LoginForm configured={configured} notice={notice} masterSetupAvailable={masterSetupAvailable} />;
}
