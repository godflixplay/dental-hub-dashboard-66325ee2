import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";
import { getSupabaseAdmin } from "@/integrations/supabase/admin.server";

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
// adminLogs — envios agrupados por usuário, com filtro de data
// ============================================================
export const adminLogs = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      limit: z.number().min(1).max(1000).default(500),
      filtroStatus: z.enum(["todos", "enviado", "falha_envio"]).default("todos"),
      dataInicio: z.string().optional(), // ISO
      dataFim: z.string().optional(), // ISO
    }),
  )
  .handler(async ({ data }) => {
    const supabase = await requireAdmin(data.accessToken);
    let q = supabase
      .from("envios_whatsapp")
      .select("id, telefone, status, created_at, user_id, instancia_id, erro, nome")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filtroStatus !== "todos") q = q.eq("status", data.filtroStatus);
    if (data.dataInicio) q = q.gte("created_at", data.dataInicio);
    if (data.dataFim) q = q.lte("created_at", data.dataFim);
    const { data: envios, error } = await q;
    if (error) throw new Error(error.message);

    // Buscar emails/nome dos profiles em batch
    const userIds = Array.from(
      new Set((envios ?? []).map((e) => e.user_id).filter(Boolean)),
    );
    const profMap: Record<
      string,
      { email: string; nome_responsavel: string | null }
    > = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, nome_responsavel")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profMap[p.id] = {
          email: p.email,
          nome_responsavel: p.nome_responsavel ?? null,
        };
      }
    }

    type EnvioOut = {
      id: string;
      telefone: string;
      status: string;
      created_at: string;
      user_id: string;
      instancia_id: string | null;
      erro: string | null;
      nome: string | null;
      email: string;
      nome_responsavel: string | null;
    };

    const enviosOut: EnvioOut[] = (envios ?? []).map((e) => ({
      id: e.id,
      telefone: e.telefone,
      status: e.status,
      created_at: e.created_at,
      user_id: e.user_id,
      instancia_id: e.instancia_id ?? null,
      erro: e.erro ?? null,
      nome: e.nome ?? null,
      email: profMap[e.user_id]?.email ?? "—",
      nome_responsavel: profMap[e.user_id]?.nome_responsavel ?? null,
    }));

    // Agrupar por usuário
    type Group = {
      user_id: string;
      email: string;
      nome_responsavel: string | null;
      total: number;
      enviados: number;
      falhas: number;
      ultimoEnvio: string | null;
      envios: EnvioOut[];
    };
    const grupos = new Map<string, Group>();
    for (const e of enviosOut) {
      let g = grupos.get(e.user_id);
      if (!g) {
        g = {
          user_id: e.user_id,
          email: e.email,
          nome_responsavel: e.nome_responsavel,
          total: 0,
          enviados: 0,
          falhas: 0,
          ultimoEnvio: null,
          envios: [],
        };
        grupos.set(e.user_id, g);
      }
      g.total += 1;
      if (e.status === "enviado") g.enviados += 1;
      else if (e.status === "falha_envio") g.falhas += 1;
      if (!g.ultimoEnvio || e.created_at > g.ultimoEnvio) {
        g.ultimoEnvio = e.created_at;
      }
      g.envios.push(e);
    }
    const grupoList = Array.from(grupos.values()).sort((a, b) => {
      if (!a.ultimoEnvio) return 1;
      if (!b.ultimoEnvio) return -1;
      return b.ultimoEnvio.localeCompare(a.ultimoEnvio);
    });

    return { envios: enviosOut, grupos: grupoList };
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

// ============================================================
// adminEvolutionInstances — lista status persistido + check live opcional
// ============================================================
export const adminEvolutionInstances = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const supabase = await requireAdmin(data.accessToken);
    // Tenta com updated_at/project_tag; se a migration ainda não foi aplicada,
    // faz fallback para created_at e segue funcionando.
    let instancias:
      | Array<{
          id: string;
          user_id: string;
          instance_name: string;
          status: string;
          updated_at: string | null;
          project_tag: string | null;
        }>
      | null = null;
    let queryError: { message: string; code?: string } | null = null;
    {
      const res = await supabase
        .from("whatsapp_instances")
        .select("id, user_id, instance_name, status, updated_at, project_tag")
        .order("updated_at", { ascending: false });
      instancias = res.data as typeof instancias;
      queryError = res.error;
    }
    if (queryError) {
      // Fallback sem colunas novas
      const res = await supabase
        .from("whatsapp_instances")
        .select("id, user_id, instance_name, status, created_at")
        .order("created_at", { ascending: false });
      if (res.error) {
        // Tabela/colunas indisponíveis — devolve vazio em vez de derrubar a tela
        return { instancias: [], migrationPending: true as const };
      }
      instancias = (res.data ?? []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        instance_name: r.instance_name,
        status: r.status,
        updated_at: r.created_at ?? null,
        project_tag: null,
      }));
    }

    const ids = Array.from(
      new Set((instancias ?? []).map((i) => i.user_id).filter(Boolean)),
    );
    const profMap: Record<
      string,
      { email: string; nome_responsavel: string | null }
    > = {};
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, email, nome_responsavel")
        .in("id", ids);
      for (const p of profs ?? []) {
        profMap[p.id] = {
          email: p.email,
          nome_responsavel: p.nome_responsavel ?? null,
        };
      }
    }

    return {
      instancias: (instancias ?? []).map((i) => ({
        ...i,
        email: profMap[i.user_id]?.email ?? "—",
        nome_responsavel: profMap[i.user_id]?.nome_responsavel ?? null,
      })),
      migrationPending: false as const,
    };
  });

// ============================================================
// adminRefreshInstanceStatus — checa Evolution API e persiste
// ============================================================
export const adminRefreshInstanceStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      instanceName: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const baseUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error("Evolution API não configurada");
    }

    const url = `${baseUrl.replace(/\/+$/, "")}/instance/connectionState/${encodeURIComponent(data.instanceName)}`;
    const res = await fetch(url, { headers: { apikey: apiKey } });

    let novoStatus = "disconnected";
    if (res.ok) {
      const json = (await res.json().catch(() => null)) as
        | { instance?: { state?: string }; state?: string }
        | null;
      const state = json?.instance?.state ?? json?.state;
      if (state === "open") novoStatus = "connected";
      else if (state === "connecting") novoStatus = "connecting";
      else novoStatus = "disconnected";
    }

    const admin = getSupabaseAdmin();
    await admin
      .from("whatsapp_instances")
      .update({ status: novoStatus, updated_at: new Date().toISOString() })
      .eq("instance_name", data.instanceName);

    return { instance_name: data.instanceName, status: novoStatus };
  });
