import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getSupabaseAdmin } from "@/integrations/supabase/admin.server";

// ============================================================
// Server functions para o sino de notificações in-app.
// ============================================================

async function getAuthedClient(accessToken: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Não autenticado");
  return { supabase, user: data.user };
}

// Lista as 30 mais recentes do usuário corrente.
export const listNotificacoes = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase } = await getAuthedClient(data.accessToken);
    const { data: rows, error } = await supabase
      .from("notificacoes")
      .select("id, titulo, mensagem, tipo, link, lida, audiencia, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      // Se a tabela ainda não foi criada, devolve vazio em vez de derrubar a UI
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("notificacoes") || msg.includes("schema cache")) {
        return { notificacoes: [], migrationPending: true as const };
      }
      throw new Error(error.message);
    }
    return { notificacoes: rows ?? [], migrationPending: false as const };
  });

// Marca uma ou todas como lidas
export const marcarComoLida = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      id: z.string().uuid().optional(), // sem id => todas
    }),
  )
  .handler(async ({ data }) => {
    const { supabase } = await getAuthedClient(data.accessToken);
    let q = supabase.from("notificacoes").update({ lida: true });
    if (data.id) q = q.eq("id", data.id);
    else q = q.eq("lida", false);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cria notificação (uso interno em handlers, ainda exposto p/ admin testar)
export const criarNotificacao = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      userId: z.string().uuid(),
      titulo: z.string().min(1).max(200),
      mensagem: z.string().min(1).max(1000),
      tipo: z.enum(["info", "sucesso", "aviso", "erro"]).default("info"),
      audiencia: z.enum(["cliente", "admin"]).default("cliente"),
      link: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ data }) => {
    // Apenas admin pode criar notificação para outro usuário.
    const { supabase, user } = await getAuthedClient(data.accessToken);
    if (data.userId !== user.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (!profile || profile.role !== "admin") {
        throw new Error("Acesso negado");
      }
    }
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("notificacoes").insert({
      user_id: data.userId,
      titulo: data.titulo,
      mensagem: data.mensagem,
      tipo: data.tipo,
      audiencia: data.audiencia,
      link: data.link ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
