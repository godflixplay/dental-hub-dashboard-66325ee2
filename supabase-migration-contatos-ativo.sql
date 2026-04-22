-- =============================================================
-- MIGRATION: Adiciona soft-delete em contatos (coluna `ativo`)
-- Rode este SQL no SQL Editor do Supabase externo
-- =============================================================

ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS contatos_ativo_idx
  ON public.contatos (user_id, ativo);

-- Garantir que registros existentes fiquem ativos
UPDATE public.contatos SET ativo = true WHERE ativo IS NULL;
