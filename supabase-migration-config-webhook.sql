-- Tabela de configuração do webhook n8n por usuário.
-- Permite alternar entre ambiente de teste e produção sem alterar código.

create table if not exists public.config_webhook (
  user_id uuid primary key references auth.users(id) on delete cascade,
  modo text not null default 'teste' check (modo in ('teste', 'producao')),
  updated_at timestamptz not null default now()
);

alter table public.config_webhook enable row level security;

drop policy if exists "config_webhook_select_own" on public.config_webhook;
create policy "config_webhook_select_own"
  on public.config_webhook for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "config_webhook_insert_own" on public.config_webhook;
create policy "config_webhook_insert_own"
  on public.config_webhook for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "config_webhook_update_own" on public.config_webhook;
create policy "config_webhook_update_own"
  on public.config_webhook for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
