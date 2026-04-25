-- =============================================================
-- MIGRATION: profiles.telefone_contato + tabela notificacoes
-- Rode este SQL no SQL Editor do Supabase externo.
-- =============================================================

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

-- 2) Tabela de notificações in-app (sino do header)
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
