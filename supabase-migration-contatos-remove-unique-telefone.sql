-- =============================================================
-- MIGRATION: Remove unicidade de telefone em contatos
-- Permite múltiplos contatos com o mesmo telefone (mesmo usuário).
-- Cada contato é independente e pode ter sua própria data_nascimento.
-- Rode este SQL no SQL Editor do Supabase.
-- =============================================================

ALTER TABLE public.contatos
  DROP CONSTRAINT IF EXISTS contatos_user_telefone_unique;

-- Índice não-único para manter consultas por telefone rápidas.
CREATE INDEX IF NOT EXISTS contatos_user_telefone_idx
  ON public.contatos (user_id, telefone);

-- Índice para filtros por dia/mês de data_nascimento (envio de aniversariantes).
CREATE INDEX IF NOT EXISTS contatos_user_dia_mes_idx
  ON public.contatos (
    user_id,
    (EXTRACT(MONTH FROM data_nascimento)),
    (EXTRACT(DAY FROM data_nascimento))
  );
