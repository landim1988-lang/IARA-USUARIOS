create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.admin_allowlist (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_allowlist enable row level security;
revoke all on public.admin_allowlist from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_allowlist
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  color text not null default '#18264d' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  portal_url text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  responsible text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accesses (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.banks (id) on delete restrict,
  login text not null check (length(trim(login)) > 0),
  status text not null default 'active' check (status in ('active', 'blocked', 'canceled')),
  notes text,
  created_at timestamptz not null default now(),
  password_changed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (bank_id, login)
);

create table public.access_teams (
  access_id uuid not null references public.accesses (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (access_id, team_id)
);

create table public.access_credentials (
  access_id uuid primary key references public.accesses (id) on delete cascade,
  encrypted_password bytea not null,
  updated_at timestamptz not null default now()
);

create table public.access_history (
  id bigint generated always as identity primary key,
  access_id uuid not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users (id) on delete set null,
  field_name text not null,
  previous_value text,
  new_value text
);

create index accesses_bank_id_idx on public.accesses (bank_id);
create index accesses_status_idx on public.accesses (status);
create index access_teams_team_id_idx on public.access_teams (team_id);
create index access_history_access_id_changed_at_idx on public.access_history (access_id, changed_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger banks_set_updated_at before update on public.banks
for each row execute function private.set_updated_at();
create trigger teams_set_updated_at before update on public.teams
for each row execute function private.set_updated_at();
create trigger accesses_set_updated_at before update on public.accesses
for each row execute function private.set_updated_at();

create or replace function private.log_access_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_id_value uuid;
  old_row jsonb;
  new_row jsonb;
  field_key text;
begin
  access_id_value := case when tg_op = 'DELETE' then old.id else new.id end;
  if tg_op = 'INSERT' then
    insert into public.access_history (access_id, changed_by, field_name, previous_value, new_value)
    values (access_id_value, auth.uid(), 'acesso', null, 'Acesso criado');
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.access_history (access_id, changed_by, field_name, previous_value, new_value)
    values (access_id_value, auth.uid(), 'acesso', 'Acesso ativo', 'Acesso excluído');
    return old;
  end if;

  old_row := to_jsonb(old) - 'updated_at' - 'password_changed_at';
  new_row := to_jsonb(new) - 'updated_at' - 'password_changed_at';
  for field_key in select jsonb_object_keys(new_row)
  loop
    if old_row -> field_key is distinct from new_row -> field_key then
      insert into public.access_history (access_id, changed_by, field_name, previous_value, new_value)
      values (access_id_value, auth.uid(), field_key, old_row ->> field_key, new_row ->> field_key);
    end if;
  end loop;
  return new;
end;
$$;

create trigger accesses_write_history
after insert or update or delete on public.accesses
for each row execute function private.log_access_change();

create or replace function private.log_access_team_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_id_value uuid;
  team_id_value uuid;
  team_name_value text;
  operation_label text;
begin
  if tg_op = 'DELETE' then
    access_id_value := old.access_id;
    team_id_value := old.team_id;
  else
    access_id_value := new.access_id;
    team_id_value := new.team_id;
  end if;
  select name into team_name_value from public.teams where id = team_id_value;
  operation_label := case when tg_op = 'DELETE' then null else team_name_value end;
  insert into public.access_history (access_id, changed_by, field_name, previous_value, new_value)
  values (
    access_id_value,
    auth.uid(),
    'equipes',
    case when tg_op = 'DELETE' then team_name_value else null end,
    operation_label
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger access_teams_write_history
after insert or delete on public.access_teams
for each row execute function private.log_access_team_change();

create or replace function public.set_access_password(p_access_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  encryption_key text;
  password_exists boolean;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado'; end if;
  if p_password is null or length(p_password) < 1 then raise exception 'A senha não pode ficar vazia'; end if;

  select decrypted_secret into encryption_key
  from vault.decrypted_secrets
  where name = 'stilo_access_password_key'
  limit 1;
  if encryption_key is null then raise exception 'Chave de criptografia não configurada no Vault'; end if;

  select exists(select 1 from public.access_credentials where access_id = p_access_id)
  into password_exists;
  if not exists(select 1 from public.accesses where id = p_access_id) then raise exception 'Acesso não encontrado'; end if;

  insert into public.access_credentials (access_id, encrypted_password, updated_at)
  values (p_access_id, extensions.pgp_sym_encrypt(p_password, encryption_key, 'cipher-algo=aes256'), now())
  on conflict (access_id) do update
  set encrypted_password = excluded.encrypted_password, updated_at = now();

  update public.accesses set password_changed_at = now() where id = p_access_id;
  insert into public.access_history (access_id, changed_by, field_name, previous_value, new_value)
  values (p_access_id, auth.uid(), 'senha', case when password_exists then 'Senha alterada' else null end, 'Senha alterada');
end;
$$;

create or replace function public.reveal_access_password(p_access_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  encryption_key text;
  password_ciphertext bytea;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado'; end if;
  select decrypted_secret into encryption_key
  from vault.decrypted_secrets
  where name = 'stilo_access_password_key'
  limit 1;
  if encryption_key is null then raise exception 'Chave de criptografia não configurada no Vault'; end if;
  select encrypted_password into password_ciphertext
  from public.access_credentials
  where access_id = p_access_id;
  if password_ciphertext is null then raise exception 'Senha não cadastrada'; end if;
  return extensions.pgp_sym_decrypt(password_ciphertext, encryption_key);
end;
$$;

revoke all on function public.set_access_password(uuid, text) from public, anon;
revoke all on function public.reveal_access_password(uuid) from public, anon;
grant execute on function public.set_access_password(uuid, text) to authenticated;
grant execute on function public.reveal_access_password(uuid) to authenticated;

create or replace function public.save_access(
  p_access_id uuid,
  p_bank_id uuid,
  p_login text,
  p_status text,
  p_notes text,
  p_team_ids uuid[],
  p_password text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  access_id_value uuid;
  selected_team_id uuid;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado'; end if;
  if p_login is null or length(trim(p_login)) = 0 then raise exception 'O login é obrigatório'; end if;
  if p_status is null or p_status not in ('active', 'blocked', 'canceled') then raise exception 'Status inválido'; end if;

  if p_access_id is null then
    insert into public.accesses (bank_id, login, status, notes)
    values (p_bank_id, trim(p_login), p_status, nullif(trim(p_notes), ''))
    returning id into access_id_value;
  else
    update public.accesses
    set bank_id = p_bank_id, login = trim(p_login), status = p_status, notes = nullif(trim(p_notes), '')
    where id = p_access_id
    returning id into access_id_value;
    if access_id_value is null then raise exception 'Acesso não encontrado'; end if;
  end if;

  delete from public.access_teams
  where access_id = access_id_value
    and not (team_id = any(coalesce(p_team_ids, array[]::uuid[])));

  foreach selected_team_id in array coalesce(p_team_ids, array[]::uuid[])
  loop
    insert into public.access_teams (access_id, team_id)
    values (access_id_value, selected_team_id)
    on conflict do nothing;
  end loop;

  if p_password is not null then
    perform public.set_access_password(access_id_value, p_password);
  end if;

  return access_id_value;
end;
$$;
revoke all on function public.save_access(uuid, uuid, text, text, text, uuid[], text) from public, anon;
grant execute on function public.save_access(uuid, uuid, text, text, text, uuid[], text) to authenticated;

alter table public.banks enable row level security;
alter table public.teams enable row level security;
alter table public.accesses enable row level security;
alter table public.access_teams enable row level security;
alter table public.access_credentials enable row level security;
alter table public.access_history enable row level security;

create policy "admin manages banks" on public.banks
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manages teams" on public.teams
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manages accesses" on public.accesses
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin manages access teams" on public.access_teams
for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin reads access history" on public.access_history
for select to authenticated using ((select public.is_admin()));

revoke all on public.access_credentials from public, anon, authenticated;
revoke insert, update, delete on public.access_history from public, anon, authenticated;
grant select, insert, update, delete on public.banks, public.teams, public.accesses, public.access_teams to authenticated;
grant select on public.access_history to authenticated;

insert into public.teams (name) values ('Stilo Salão'), ('Stilo Callcenter')
on conflict (name) do nothing;