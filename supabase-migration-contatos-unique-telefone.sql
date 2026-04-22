-- =============================================================
-- MIGRATION: Garante unicidade de telefone por usuário em contatos
-- Necessário para o upsert de planilhas (ignorar duplicados)
-- Rode este SQL no SQL Editor do Supabase
-- =============================================================

-- Remove eventuais duplicatas existentes (mantém o registro mais antigo)
DELETE FROM public.contatos a
USING public.contatos b
WHERE a.ctid > b.ctid
  AND a.user_id = b.user_id
  AND a.telefone = b.telefone;

-- Cria a constraint de unicidade composta
ALTER TABLE public.contatos
  DROP CONSTRAINT IF EXISTS contatos_user_telefone_unique;

ALTER TABLE public.contatos
  ADD CONSTRAINT contatos_user_telefone_unique UNIQUE (user_id, telefone);
