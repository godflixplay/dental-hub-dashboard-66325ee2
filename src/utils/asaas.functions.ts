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
  const env = (process.env.ASAAS_ENV ?? "sandbox").toLowerCase();
  const baseUrl = env === "production" ? ASAAS_PROD_BASE : ASAAS_SANDBOX_BASE;
  return { apiKey, baseUrl, env };
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
export const criarAssinatura = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      accessToken: z.string().min(1),
      planoSlug: z.enum(["mensal", "anual"]),
      billingType: z.enum(["PIX", "BOLETO", "CREDIT_CARD"]).default("PIX"),
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

    // Verificar assinatura existente ativa
    const { data: existente } = await supabase
      .from("assinaturas")
      .select("id, status, asaas_subscription_id")
      .eq("user_id", userId)
      .in("status", ["trial", "ativa", "atrasada"])
      .maybeSingle();
    if (existente) {
      throw new Error(
        "Já existe uma assinatura ativa. Cancele a atual antes de criar outra.",
      );
    }

    // 1) Criar/recuperar customer no Asaas
    // notificationDisabled=true desativa todos os emails/SMS do Asaas para
    // este cliente (lembrete de vencimento, recibo de pagamento, etc.).
    // O usuário acompanha a cobrança apenas pelo app Dental Hub.
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

    // 2) Criar subscription
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 1);
    const nextDueDate = nextDue.toISOString().slice(0, 10);

    const subscription = (await asaasRequest("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: data.billingType,
        value: Number(plano.valor),
        nextDueDate,
        cycle: plano.ciclo === "anual" ? "YEARLY" : "MONTHLY",
        description: `Dental Hub — Plano ${plano.nome}`,
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
// cancelarAssinatura
// ============================================================
export const cancelarAssinatura = createServerFn({ method: "POST" })
  .inputValidator(z.object({ accessToken: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabase, userId } = await getAuthedSupabase(data.accessToken);

    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("id, asaas_subscription_id, status")
      .eq("user_id", userId)
      .in("status", ["trial", "ativa", "atrasada"])
      .maybeSingle();

    if (!assinatura?.asaas_subscription_id) {
      throw new Error("Nenhuma assinatura ativa para cancelar");
    }

    await asaasRequest(`/subscriptions/${assinatura.asaas_subscription_id}`, {
      method: "DELETE",
    });

    const { error } = await supabase
      .from("assinaturas")
      .update({ status: "cancelada" })
      .eq("id", assinatura.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
