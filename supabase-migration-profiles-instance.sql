-- =============================================================
-- MIGRATION: profiles (nome_responsavel, nome_clinica)
--            + whatsapp_instances.project_tag
-- Rode este SQL no SQL Editor do Supabase externo
-- =============================================================

-- 1) Campos de identificação do cliente
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nome_responsavel text,
  ADD COLUMN IF NOT EXISTS nome_clinica text;

-- Backfill a partir do raw_user_meta_data (signup envia esses campos)
UPDATE public.profiles p
SET
  nome_responsavel = COALESCE(
    p.nome_responsavel,
    NULLIF(u.raw_user_meta_data ->> 'nome_responsavel', '')
  ),
  nome_clinica = COALESCE(
    p.nome_clinica,
    NULLIF(u.raw_user_meta_data ->> 'nome_clinica', '')
  )
FROM auth.users u
WHERE u.id = p.id;

-- 2) Tag de projeto (separa automações: aniversário, cobrança, etc.)
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS project_tag text NOT NULL DEFAULT 'dentalhub_aniversario';

CREATE INDEX IF NOT EXISTS whatsapp_instances_project_tag_idx
  ON public.whatsapp_instances (project_tag);

-- 3) instance_name único globalmente (evita colisão entre clientes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'whatsapp_instances_instance_name_unique'
  ) THEN
    CREATE UNIQUE INDEX whatsapp_instances_instance_name_unique
      ON public.whatsapp_instances (instance_name);
  END IF;
END$$;
