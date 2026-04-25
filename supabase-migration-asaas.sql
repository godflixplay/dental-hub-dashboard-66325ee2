-- ============================================================
-- Migration: Sistema de assinaturas Asaas
-- Execute no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================

-- ----------------------------------------------------------
-- 1) Tabela: planos
-- ----------------------------------------------------------
create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  valor numeric(10,2) not null,
  ciclo text not null check (ciclo in ('mensal','anual')),
  descricao text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.planos enable row level security;

drop policy if exists "planos_select_all" on public.planos;
create policy "planos_select_all"
  on public.planos for select
  using (true);

-- Seed dos planos (idempotente)
insert into public.planos (slug, nome, valor, ciclo, descricao)
values
  ('mensal', 'Mensal', 47.00, 'mensal', 'Acesso mensal recorrente'),
  ('anual',  'Anual',  397.00, 'anual', 'Acesso anual com economia de ~30%')
on conflict (slug) do update
  set valor = excluded.valor,
      nome  = excluded.nome,
      descricao = excluded.descricao;

-- ----------------------------------------------------------
-- 2) Tabela: assinaturas
-- ----------------------------------------------------------
create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plano_id uuid not null references public.planos(id),
  asaas_customer_id text,
  asaas_subscription_id text unique,
  status text not null default 'trial'
    check (status in ('trial','ativa','atrasada','cancelada','expirada')),
  trial_ate timestamptz,
  proxima_cobranca timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assinaturas_user_id on public.assinaturas(user_id);
create index if not exists idx_assinaturas_status on public.assinaturas(status);

alter table public.assinaturas enable row level security;

drop policy if exists "assinaturas_select_own" on public.assinaturas;
create policy "assinaturas_select_own"
  on public.assinaturas for select
  using (auth.uid() = user_id);

drop policy if exists "assinaturas_select_admin" on public.assinaturas;
create policy "assinaturas_select_admin"
  on public.assinaturas for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "assinaturas_insert_own" on public.assinaturas;
create policy "assinaturas_insert_own"
  on public.assinaturas for insert
  with check (auth.uid() = user_id);

drop policy if exists "assinaturas_update_own" on public.assinaturas;
create policy "assinaturas_update_own"
  on public.assinaturas for update
  using (auth.uid() = user_id);

-- ----------------------------------------------------------
-- 3) Tabela: pagamentos (alimentada pelo webhook Asaas)
-- ----------------------------------------------------------
create table if not exists public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid references public.assinaturas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asaas_payment_id text unique not null,
  valor numeric(10,2) not null,
  status text not null,           -- PENDING / RECEIVED / OVERDUE / REFUNDED / CONFIRMED
  billing_type text,              -- PIX / BOLETO / CREDIT_CARD
  data_vencimento date,
  data_pagamento timestamptz,
  invoice_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_pagamentos_user_id on public.pagamentos(user_id);
create index if not exists idx_pagamentos_assinatura_id on public.pagamentos(assinatura_id);

alter table public.pagamentos enable row level security;

drop policy if exists "pagamentos_select_own" on public.pagamentos;
create policy "pagamentos_select_own"
  on public.pagamentos for select
  using (auth.uid() = user_id);

drop policy if exists "pagamentos_select_admin" on public.pagamentos;
create policy "pagamentos_select_admin"
  on public.pagamentos for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- Inserts/updates em pagamentos só via service_role (webhook Asaas).
-- Não criamos policy de insert para anon/authenticated.

-- ----------------------------------------------------------
-- 4) Trigger updated_at em assinaturas
-- ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assinaturas_updated_at on public.assinaturas;
create trigger trg_assinaturas_updated_at
  before update on public.assinaturas
  for each row execute function public.set_updated_at();

-- ============================================================
-- FIM
-- ============================================================
