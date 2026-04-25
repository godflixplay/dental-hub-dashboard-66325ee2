-- =============================================================
-- MIGRATION: Novos planos (Mensal/Trimestral/Semestral/Anual)
-- Rode este bloco no SQL Editor do Supabase. É idempotente.
-- =============================================================

-- 1) Atualizar check constraint do ciclo para aceitar os 4 valores
ALTER TABLE public.planos DROP CONSTRAINT IF EXISTS planos_ciclo_check;
ALTER TABLE public.planos
  ADD CONSTRAINT planos_ciclo_check
  CHECK (ciclo IN ('mensal', 'trimestral', 'semestral', 'anual'));

-- 2) Garantir coluna 'descricao' (já existe pelo schema original; safe)
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS descricao text;

-- 3) Desativar planos antigos
UPDATE public.planos SET ativo = false
  WHERE slug NOT IN ('mensal', 'trimestral', 'semestral', 'anual');

-- 4) Inserir/atualizar os 4 planos definitivos
INSERT INTO public.planos (slug, nome, valor, ciclo, descricao, ativo)
VALUES
  ('mensal',      'Plano Mensal',      37.00,  'mensal',      'Renovação a cada 30 dias',  true),
  ('trimestral',  'Plano Trimestral',  99.90,  'trimestral',  'Renovação a cada 90 dias',  true),
  ('semestral',   'Plano Semestral',   188.70, 'semestral',   'Renovação a cada 180 dias', true),
  ('anual',       'Plano Anual',       355.20, 'anual',       'Renovação a cada 365 dias', true)
ON CONFLICT (slug) DO UPDATE SET
  nome      = EXCLUDED.nome,
  valor     = EXCLUDED.valor,
  ciclo     = EXCLUDED.ciclo,
  descricao = EXCLUDED.descricao,
  ativo     = true;

-- 5) Garantir colunas de controle em assinaturas (acesso até proxima_cobranca
--    mesmo após cancelar, e tutorial visto)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tutorial_visto boolean NOT NULL DEFAULT false;
