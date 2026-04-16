-- =============================================================
-- MIGRATION: Aniversários — config_mensagem, envios, storage
-- Rode este SQL no SQL Editor do Supabase
-- =============================================================

-- 1. Tabela config_mensagem
CREATE TABLE IF NOT EXISTS public.config_mensagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mensagem text NOT NULL DEFAULT '🎂 Feliz aniversário, {nome}! 🎉',
  imagem_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.config_mensagem ENABLE ROW LEVEL SECURITY;

-- Policies config_mensagem (usuário vê/edita a própria; admin vê tudo)
DROP POLICY IF EXISTS "config_mensagem_select_own" ON public.config_mensagem;
CREATE POLICY "config_mensagem_select_own" ON public.config_mensagem
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "config_mensagem_insert_own" ON public.config_mensagem;
CREATE POLICY "config_mensagem_insert_own" ON public.config_mensagem
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "config_mensagem_update_own" ON public.config_mensagem;
CREATE POLICY "config_mensagem_update_own" ON public.config_mensagem
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "config_mensagem_delete_own" ON public.config_mensagem;
CREATE POLICY "config_mensagem_delete_own" ON public.config_mensagem
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2. Tabela envios
CREATE TABLE IF NOT EXISTS public.envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contato_id uuid REFERENCES public.contatos(id) ON DELETE SET NULL,
  telefone text NOT NULL,
  nome text,
  status text NOT NULL CHECK (status IN ('enviado', 'erro', 'pendente')),
  erro text,
  data_envio timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS envios_user_id_idx ON public.envios(user_id);
CREATE INDEX IF NOT EXISTS envios_data_envio_idx ON public.envios(data_envio DESC);

ALTER TABLE public.envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "envios_select_own" ON public.envios;
CREATE POLICY "envios_select_own" ON public.envios
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "envios_insert_own" ON public.envios;
CREATE POLICY "envios_insert_own" ON public.envios
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 3. Storage bucket para imagens das mensagens
INSERT INTO storage.buckets (id, name, public)
VALUES ('mensagens', 'mensagens', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket: leitura pública, escrita apenas no próprio folder {user_id}/...
DROP POLICY IF EXISTS "mensagens_public_read" ON storage.objects;
CREATE POLICY "mensagens_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'mensagens');

DROP POLICY IF EXISTS "mensagens_user_insert" ON storage.objects;
CREATE POLICY "mensagens_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mensagens'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "mensagens_user_update" ON storage.objects;
CREATE POLICY "mensagens_user_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mensagens'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "mensagens_user_delete" ON storage.objects;
CREATE POLICY "mensagens_user_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'mensagens'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
