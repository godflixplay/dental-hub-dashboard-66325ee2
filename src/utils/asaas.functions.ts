import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/client";

// ============================================================
// Asaas — integração de assinaturas (sandbox)
// ============================================================
// Este módulo expõe server functions para criar/cancelar assinaturas
// e ler dados do usuário corrente. Inserts em `pagamentos` e mudanças
// de status disparadas pelo Asaas chegam via webhook público em
// /api/public/asaas-webhook.

const ASAAS_SANDBOX_BASE = "https://sandbox.asaas.com/api/v3";
const ASAAS_PROD_BASE = "https://api.asaas.com/v3";

function getAsaasConfig() {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new Error("ASAAS_API_KEY não configurada");

  // Detecção do ambiente:
  // 1) Chaves de produção do Asaas começam com "$aact_prod_".
  //    Chaves de sandbox começam com "$aact_hmlg_" ou "$aact_YT...".
  //    Se a chave indicar produção, usamos produção — independente do
  //    ASAAS_ENV — para evitar erro 401 "invalid_environment".
  // 2) Caso contrário, respeitamos ASAAS_ENV (default: sandbox).
  const trimmedKey = apiKey.trim();
  const keyLooksProd = trimmedKey.startsWith("$aact_prod_");
  const envVar = (process.env.ASAAS_ENV ?? "").trim().toLowerCase();
  const env = keyLooksProd || envVar === "production" ? "production" : "sandbox";
  const baseUrl = env === "production" ? ASAAS_PROD_BASE : ASAAS_SANDBOX_BASE;
  return { apiKey: trimmedKey, baseUrl, env };
}

async function asaasRequest(
  path: string,
  init: RequestInit & { body?: string } = {},
) {
  const { apiKey, baseUrl } = getAsaasConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    console.error("[asaas] error", res.status, data);
    throw new Error(
      `Asaas API erro ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
    );
  }
  return data;
}

async function getAuthedSupabase(accessToken: string): Promise<{
  supabase: SupabaseClient;
  userId: string;
  email: string;
}> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) throw new Error("Não autenticado");
  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? "",
  };
}

// ----------------------------------------------------------
// Tipos retornados pelo Asaas (parcial)
// ----------------------------------------------------------
interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
}
interface AsaasSubscription {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  billingType: string;
  status: string;
}

// ============================================================
// getMinhaAssinatura — leitura para a UI
// ============================================================
export const getMinhaAssinatura = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthedSupabase(data.accessToken);

    const { data: assinatura, error } = await supabase
      .from("assinaturas")
      .select("*, planos(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    const { data: pagamentos } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      assinatura: assinatura ?? null,
      pagamentos: pagamentos ?? [],
    };
  });

// ============================================================
// pingAsaas — testa conectividade/credencial chamando /myAccount
// (Apenas admin pode chamar.)
// ============================================================
export const pingAsaas = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthedSupabase(data.accessToken);
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.role !== "admin") {
      throw new Error("Apenas admin pode executar este teste");
    }
    const { env, baseUrl } = getAsaasConfig();
    try {
      const account = (await asaasRequest("/myAccount")) as {
        email?: string;
        name?: string;
        walletId?: string;
      };
      return {
        ok: true,
        env,
        baseUrl,
        account: {
          email: account.email ?? null,
          name: account.name ?? null,
          walletId: account.walletId ?? null,
        },
      };
    } catch (err) {
      return {
        ok: false,
        env,
        baseUrl,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

// ============================================================
// listarPlanos
// ============================================================
export const listarPlanos = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase } = await getAuthedSupabase(data.accessToken);
    const { data: planos, error } = await supabase
      .from("planos")
      .select("*")
      .eq("ativo", true)
      .order("valor", { ascending: true });
    if (error) throw new Error(error.message);
    return { planos: planos ?? [] };
  });

// ============================================================
// criarAssinatura
// ============================================================
// Mapa ciclo (interno) → cycle (Asaas) e dias até a próxima cobrança
const CICLO_TO_ASAAS: Record<string, string> = {
  mensal: "MONTHLY",
  trimestral: "QUARTERLY",
  semestral: "SEMIANNUALLY",
  anual: "YEARLY",
};

export const criarAssinatura = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      planoSlug: z.enum(["mensal", "trimestral", "semestral", "anual"]),
      billingType: z.enum(["PIX", "CREDIT_CARD"]).default("PIX"),
      cpfCnpj: z.string().min(11).max(20),
      nome: z.string().min(2).max(200),
      telefone: z.string().min(8).max(20).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabase, userId, email } = await getAuthedSupabase(
      data.accessToken,
    );

    // Buscar plano
    const { data: plano, error: planoErr } = await supabase
      .from("planos")
      .select("*")
      .eq("slug", data.planoSlug)
      .single();
    if (planoErr || !plano) throw new Error("Plano não encontrado");

    // Verificar assinatura existente ativa OU cancelada com acesso vigente
    const { data: existente } = await supabase
      .from("assinaturas")
      .select("id, status, asaas_subscription_id, proxima_cobranca")
      .eq("user_id", userId)
      .in("status", ["trial", "ativa", "atrasada"])
      .maybeSingle();
    if (existente) {
      throw new Error(
        "Já existe uma assinatura ativa. Cancele a atual antes de criar outra.",
      );
    }

    // 1) Criar/recuperar customer no Asaas
    const customer = (await asaasRequest("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: data.nome,
        email,
        cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
        phone: data.telefone,
        externalReference: userId,
        notificationDisabled: true,
      }),
    })) as AsaasCustomer;

    // 2) Criar subscription recorrente no ciclo correto
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);
    const nextDueDate = nextDue.toISOString().slice(0, 10);

    const cycleAsaas = CICLO_TO_ASAAS[plano.ciclo as string] ?? "MONTHLY";

    const subscription = (await asaasRequest("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: data.billingType,
        value: Number(plano.valor),
        nextDueDate,
        cycle: cycleAsaas,
        description: `Dental Hub — ${plano.nome}`,
        externalReference: userId,
      }),
    })) as AsaasSubscription;

    // 3) Persistir no Supabase
    const { data: novaAssinatura, error: insertErr } = await supabase
      .from("assinaturas")
      .insert({
        user_id: userId,
        plano_id: plano.id,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        status: "ativa",
        proxima_cobranca: subscription.nextDueDate,
      })
      .select()
      .single();
    if (insertErr) throw new Error(insertErr.message);

    return { assinatura: novaAssinatura };
  });

// ============================================================
// cancelarAssinatura — cancelamento "soft":
// - desliga a renovação no Asaas (DELETE /subscriptions/:id)
// - marca status = 'cancelada' no Supabase
// - mas mantém proxima_cobranca como "data limite de acesso"
// O gate de acesso (utilitário hasAcessoAtivo) considera que
// 'cancelada' com proxima_cobranca >= hoje ainda tem acesso.
// ============================================================
export const cancelarAssinatura = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthedSupabase(data.accessToken);

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("id, asaas_subscription_id, status, proxima_cobranca")
      .eq("user_id", userId)
      .in("status", ["trial", "ativa", "atrasada"])
      .maybeSingle();

    if (!assinatura?.asaas_subscription_id) {
      throw new Error("Nenhuma assinatura ativa para cancelar");
    }

    // Desliga renovação no Asaas (não emite mais novas cobranças)
    try {
      await asaasRequest(
        `/subscriptions/${assinatura.asaas_subscription_id}`,
        { method: "DELETE" },
      );
    } catch (e) {
      // Se a subscription já foi deletada no Asaas, segue em frente
      console.warn("[asaas] DELETE subscription falhou, prosseguindo:", e);
    }

    const { error } = await supabase
      .from("assinaturas")
      .update({ status: "cancelada" })
      .eq("id", assinatura.id);
    if (error) throw new Error(error.message);

    return {
      ok: true,
      acessoAte: assinatura.proxima_cobranca,
    };
  });

// ============================================================
// hasAcessoAtivo — server function leve usada pelo gate do app
// ============================================================
export const hasAcessoAtivo = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthedSupabase(data.accessToken);

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("status, proxima_cobranca")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!assinatura) return { ativo: false, motivo: "sem_assinatura" as const };

    if (["trial", "ativa", "atrasada"].includes(assinatura.status)) {
      return { ativo: true, status: assinatura.status };
    }

    if (assinatura.status === "cancelada" && assinatura.proxima_cobranca) {
      const hoje = new Date().toISOString().slice(0, 10);
      if (assinatura.proxima_cobranca >= hoje) {
        return {
          ativo: true,
          status: "cancelada",
          acessoAte: assinatura.proxima_cobranca,
        };
      }
    }

    return { ativo: false, motivo: "expirada" as const };
  });
