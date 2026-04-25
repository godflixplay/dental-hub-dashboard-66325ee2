import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

// ============================================================
// Server functions para o painel administrativo.
// Todas exigem accessToken e validam role='admin' antes de
// retornar qualquer agregação.
// ============================================================

async function requireAdmin(accessToken: string): Promise<SupabaseClient> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userRes, error } = await supabase.auth.getUser();
  if (error || !userRes?.user) throw new Error("Não autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    throw new Error("Acesso negado: requer role admin");
  }
  return supabase;
}

async function safeCount(
  supabase: SupabaseClient,
  table: string,
  apply?: (q: ReturnType<SupabaseClient["from"]>) => unknown,
): Promise<number> {
  try {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (apply) q = apply(q) as typeof q;
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ============================================================
// adminMetrics — visão geral do dashboard
// ============================================================
export const adminMetrics = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = await requireAdmin(data.accessToken);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const inicioMesIso = inicioMes.toISOString();

    async function countAll(table: string) {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    }

    const [
      totalUsuarios,
      whatsappConectadoRes,
      contatos,
      enviadosMesRes,
      falhasMesRes,
      assinaturasAtivasRes,
    ] = await Promise.all([
      countAll("profiles"),
      supabase
        .from("whatsapp_instances")
        .select("*", { count: "exact", head: true })
        .eq("status", "connected"),
      countAll("contatos"),
      supabase
        .from("envios_whatsapp")
        .select("*", { count: "exact", head: true })
        .eq("status", "enviado")
        .gte("created_at", inicioMesIso),
      supabase
        .from("envios_whatsapp")
        .select("*", { count: "exact", head: true })
        .eq("status", "falha_envio")
        .gte("created_at", inicioMesIso),
      supabase
        .from("assinaturas")
        .select("*", { count: "exact", head: true })
        .eq("status", "ativa"),
    ]);

    const whatsappConectado = whatsappConectadoRes.count ?? 0;
    const enviadosMes = enviadosMesRes.count ?? 0;
    const falhasMes = falhasMesRes.count ?? 0;
    const assinaturasAtivas = assinaturasAtivasRes.count ?? 0;

    // MRR — soma do valor das assinaturas ativas (mensal e anual/12)
    let mrr = 0;
    try {
      const { data: rows } = await supabase
        .from("assinaturas")
        .select("planos(valor, ciclo)")
        .eq("status", "ativa");
      for (const r of (rows ?? []) as Array<{
        planos: { valor: number; ciclo: string } | { valor: number; ciclo: string }[] | null;
      }>) {
        const plano = Array.isArray(r.planos) ? r.planos[0] : r.planos;
        if (!plano) continue;
        const valor = Number(plano.valor) || 0;
        mrr += plano.ciclo === "anual" ? valor / 12 : valor;
      }
    } catch {
      mrr = 0;
    }

    const totalEnvios = enviadosMes + falhasMes;
    const taxaSucesso =
      totalEnvios > 0 ? Math.round((enviadosMes / totalEnvios) * 100) : 0;

    return {
      totalUsuarios,
      whatsappConectado,
      contatos,
      enviadosMes,
      falhasMes,
      taxaSucesso,
      mrr,
      assinaturasAtivas,
    };
  });

// ============================================================
// adminLogs — últimos envios da plataforma
// ============================================================
export const adminLogs = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      limit: z.number().min(1).max(200).default(50),
      filtroStatus: z.enum(["todos", "enviado", "falha_envio"]).default("todos"),
    }),
  )
  .handler(async ({ data }) => {
    const supabase = await requireAdmin(data.accessToken);
    let q = supabase
      .from("envios_whatsapp")
      .select("id, telefone, status, created_at, user_id, instancia_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filtroStatus !== "todos") q = q.eq("status", data.filtroStatus);
    const { data: envios, error } = await q;
    if (error) throw new Error(error.message);

    // Buscar emails dos profiles em batch
    const userIds = Array.from(
      new Set((envios ?? []).map((e) => e.user_id).filter(Boolean)),
    );
    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      for (const p of profs ?? []) emailMap[p.id] = p.email;
    }

    return {
      envios: (envios ?? []).map((e) => ({
        ...e,
        email: emailMap[e.user_id] ?? "—",
      })),
    };
  });

// ============================================================
// adminUsuarios — lista enriquecida
// ============================================================
export const adminUsuarios = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = await requireAdmin(data.accessToken);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const contatosCount: Record<string, number> = {};
    const whatsappStatus: Record<string, string> = {};
    const planoStatus: Record<string, string> = {};

    if (ids.length > 0) {
      const [contatosRes, instRes, assinRes] = await Promise.all([
        supabase.from("contatos").select("user_id").in("user_id", ids),
        supabase
          .from("whatsapp_instances")
          .select("user_id, status")
          .in("user_id", ids),
        supabase
          .from("assinaturas")
          .select("user_id, status, planos(nome)")
          .in("user_id", ids),
      ]);
      for (const c of contatosRes.data ?? []) {
        contatosCount[c.user_id] = (contatosCount[c.user_id] ?? 0) + 1;
      }
      for (const i of instRes.data ?? []) {
        whatsappStatus[i.user_id] = i.status;
      }
      for (const a of assinRes.data ?? []) {
        if (a.status === "ativa" || a.status === "trial") {
          const nome = (a as { planos?: { nome?: string } }).planos?.nome;
          planoStatus[a.user_id] = nome ?? a.status;
        }
      }
    }

    return {
      usuarios: (profiles ?? []).map((p) => ({
        ...p,
        contatos: contatosCount[p.id] ?? 0,
        whatsapp_status: whatsappStatus[p.id] ?? "desconectado",
        plano: planoStatus[p.id] ?? "Gratuito",
      })),
    };
  });
