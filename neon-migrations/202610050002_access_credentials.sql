alter table accesses add column if not exists cpf_titular varchar(14);
alter table accesses add column if not exists password_encrypted text;
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
