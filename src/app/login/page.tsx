import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ setup?: string; unauthorized?: string; expired?: string; invite?: string }> }) {
  const params = await searchParams;
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
  const notice = params.expired
    ? "Sua sessão foi encerrada após 15 minutos de inatividade. Entre novamente."
    : params.unauthorized
      ? "Esta conta não está autorizada para administrar o sistema."
      : params.setup
        ? "Finalize a configuração do Supabase e autorize a conta administradora."
        : params.invite
          ? "O convite não é válido ou expirou. Peça um novo convite ao administrador."
        : "";

  return <LoginForm configured={configured} notice={notice} />;
}