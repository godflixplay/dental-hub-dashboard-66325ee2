-- =============================================================
-- MIGRATION: profiles.telefone_contato + tabela notificacoes
--           + whatsapp_instances.updated_at / project_tag
-- Rode este SQL no SQL Editor do Supabase externo.
-- =============================================================

-- 0) Colunas faltantes em whatsapp_instances (necessárias p/ admin)
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS project_tag text;

-- Trigger para manter updated_at atualizado
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_instances_updated_at ON public.whatsapp_instances;
CREATE TRIGGER trg_whatsapp_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 1) Telefone/WhatsApp de contato no profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone_contato text;

-- Backfill a partir do raw_user_meta_data caso tenha sido enviado no signup
UPDATE public.profiles p
SET telefone_contato = COALESCE(
  p.telefone_contato,
  NULLIF(u.raw_user_meta_data ->> 'telefone_contato', '')
)
FROM auth.users u
WHERE u.id = p.id;

-- 1.1) Trigger: ao criar/atualizar usuário, espelha telefone_contato no profile
-- (também garante nome_responsavel/nome_clinica caso ainda não exista o trigger)
CREATE OR REPLACE FUNCTION public.handle_user_meta_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome_responsavel, nome_clinica, telefone_contato)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data ->> 'nome_responsavel', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'nome_clinica', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'telefone_contato', '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nome_responsavel = COALESCE(public.profiles.nome_responsavel, EXCLUDED.nome_responsavel),
    nome_clinica = COALESCE(public.profiles.nome_clinica, EXCLUDED.nome_clinica),
    telefone_contato = COALESCE(public.profiles.telefone_contato, EXCLUDED.telefone_contato);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_meta_sync ON auth.users;
CREATE TRIGGER on_auth_user_meta_sync
  AFTER INSERT OR UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_meta_sync();

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'info'
    CHECK (tipo IN ('info', 'sucesso', 'aviso', 'erro')),
  link text,
  lida boolean NOT NULL DEFAULT false,
  audiencia text NOT NULL DEFAULT 'cliente'
    CHECK (audiencia IN ('cliente', 'admin')),
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_user_id_idx
  ON public.notificacoes (user_id);
CREATE INDEX IF NOT EXISTS notificacoes_created_at_idx
  ON public.notificacoes (created_at DESC);
CREATE INDEX IF NOT EXISTS notificacoes_lida_idx
  ON public.notificacoes (user_id, lida);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON public.notificacoes;
CREATE POLICY "select_own_notifications"
  ON public.notificacoes FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "update_own_notifications" ON public.notificacoes;
CREATE POLICY "update_own_notifications"
  ON public.notificacoes FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- INSERT/DELETE são executados via service-role (server functions);
-- nenhuma policy de INSERT para o cliente comum.

-- 3) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
