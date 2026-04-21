-- =============================================================
-- MIGRATION: Adiciona instancia_id em contatos
-- Rode este SQL no SQL Editor do Supabase externo
-- =============================================================

ALTER TABLE public.contatos
  ADD COLUMN IF NOT EXISTS instancia_id uuid
  REFERENCES public.whatsapp_instances(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS contatos_instancia_id_idx
  ON public.contatos (instancia_id);
