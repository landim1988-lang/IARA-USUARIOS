# Stilo - Controle de Usuários

Aplicação privada para gerenciar acessos bancários, bancos e equipes. Interface em pt-BR, construída com Next.js e Supabase.

## Desenvolvimento local

1. Crie um projeto Supabase e copie `.env.example` para `.env.local`.
2. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os dados do projeto. Não use a chave `service_role` no navegador ou neste arquivo.
3. Opcionalmente, preencha `OPENAI_API_KEY` no `.env.local` para habilitar a sugestão de portal e logo no cadastro de bancos. Essa chave é usada somente por uma rota server-side e nunca deve ser exposta no navegador, no Git ou no Supabase.
4. No SQL Editor do Supabase, execute `supabase/migrations/202609300001_initial_schema.sql` e `supabase/migrations/202610010002_bank_logo.sql`.
5. Em Authentication, desative novos cadastros públicos e convide/crie a conta do administrador.
6. Autorize essa conta no SQL Editor, substituindo o e-mail:

```sql
insert into public.admin_allowlist (user_id)
select id from auth.users where email = 'administrador@exemplo.com'
on conflict (user_id) do nothing;
```

7. Crie a chave do Vault sem exibi-la no resultado do SQL:

```sql
select vault.create_secret(
	encode(extensions.gen_random_bytes(32), 'hex'),
	'stilo_access_password_key',
	'Chave de criptografia das senhas dos acessos bancários'
);
```

8. Instale e inicie o app:

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. A migração cadastra as equipes iniciais Stilo Salão e Stilo Callcenter. Os bancos começam vazios.

## Segurança

- O cadastro público deve permanecer desativado nas configurações de Authentication do projeto Supabase.
- A conta também precisa estar na tabela `admin_allowlist`; RLS e as rotas verificam essa autorização.
- Senhas bancárias ficam em tabela isolada e cifradas com `pgcrypto`; a chave fica no Supabase Vault.
- O backup contém os dados completos, mas só é baixado após cifragem AES-256-GCM com uma senha escolhida no momento.
- O CSV exclui as senhas. O histórico registra senha somente como “senha alterada”.
- Sessões são encerradas após 15 minutos sem atividade.

## Verificações

```bash
npm run lint
npm run build
```
