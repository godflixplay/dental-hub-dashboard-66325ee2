-- =============================================================
-- MIGRATION: Bucket `imagens-whatsapp` + coluna imagem_url
--            em whatsapp_instances (isolamento por user + instance)
-- Rode este SQL no SQL Editor do Supabase externo.
-- =============================================================

-- 1. Coluna imagem_url em whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS imagem_url text;

-- 2. Bucket público dedicado às imagens de WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('imagens-whatsapp', 'imagens-whatsapp', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Policies do bucket
-- Leitura pública (n8n / Evolution API precisam baixar a imagem)
DROP POLICY IF EXISTS "imagens_whatsapp_public_read" ON storage.objects;
CREATE POLICY "imagens_whatsapp_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'imagens-whatsapp');

-- Upload / update / delete: somente dentro do próprio folder {user_id}/...
-- Isso garante isolamento — nenhum usuário grava no folder de outro.
DROP POLICY IF EXISTS "imagens_whatsapp_user_insert" ON storage.objects;
CREATE POLICY "imagens_whatsapp_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'imagens-whatsapp'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "imagens_whatsapp_user_update" ON storage.objects;
CREATE POLICY "imagens_whatsapp_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'imagens-whatsapp'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "imagens_whatsapp_user_delete" ON storage.objects;
CREATE POLICY "imagens_whatsapp_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'imagens-whatsapp'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
