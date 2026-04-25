import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/integrations/supabase/admin.server";

// ============================================================
// Webhook do Asaas — recebe eventos de pagamento e assinatura.
// URL pública: /api/public/asaas-webhook
//
// Configurar no painel do Asaas (Configurações → Integrações →
// Webhooks). Definir o token de autenticação igual ao secret
// ASAAS_WEBHOOK_TOKEN. O Asaas envia esse valor no header
// `asaas-access-token`.
// ============================================================

interface AsaasPaymentEvent {
  event: string;
  payment?: {
    id: string;
    customer: string;
    subscription?: string;
    value: number;
    status: string;
    billingType?: string;
    dueDate?: string;
    paymentDate?: string | null;
    invoiceUrl?: string;
    externalReference?: string;
  };
  subscription?: {
    id: string;
    status?: string;
    nextDueDate?: string;
  };
}

const STATUS_TO_ASSINATURA: Record<string, string> = {
  PAYMENT_RECEIVED: "ativa",
  PAYMENT_CONFIRMED: "ativa",
  PAYMENT_OVERDUE: "atrasada",
  PAYMENT_DELETED: "cancelada",
  PAYMENT_REFUNDED: "cancelada",
  SUBSCRIPTION_CANCELED: "cancelada",
};

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1) Validar token
        const expected = process.env.ASAAS_WEBHOOK_TOKEN;
        if (!expected) {
          console.error("[asaas-webhook] ASAAS_WEBHOOK_TOKEN não configurado");
          return new Response("Server misconfigured", { status: 500 });
        }
        const received = request.headers.get("asaas-access-token");
        if (received !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        // 2) Ler payload
        let payload: AsaasPaymentEvent;
        try {
          payload = (await request.json()) as AsaasPaymentEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const event = payload.event ?? "";
        console.log("[asaas-webhook] event:", event);

        // 3) Eventos de pagamento
        if (event.startsWith("PAYMENT_") && payload.payment) {
          const p = payload.payment;

          // Localizar assinatura local pelo asaas_subscription_id ou
          // user_id via externalReference.
          let assinaturaId: string | null = null;
          let userId: string | null = p.externalReference ?? null;

          if (p.subscription) {
            const { data: assin } = await supabase
              .from("assinaturas")
              .select("id, user_id")
              .eq("asaas_subscription_id", p.subscription)
              .maybeSingle();
            if (assin) {
              assinaturaId = assin.id;
              userId = userId ?? assin.user_id;
            }
          }

          if (!userId) {
            console.warn("[asaas-webhook] sem user_id, ignorando", p.id);
            return new Response("ok (no user)", { status: 200 });
          }

          // Upsert do pagamento
          await supabase.from("pagamentos").upsert(
            {
              assinatura_id: assinaturaId,
              user_id: userId,
              asaas_payment_id: p.id,
              valor: p.value,
              status: p.status,
              billing_type: p.billingType ?? null,
              data_vencimento: p.dueDate ?? null,
              data_pagamento: p.paymentDate ?? null,
              invoice_url: p.invoiceUrl ?? null,
            },
            { onConflict: "asaas_payment_id" },
          );

          // Atualizar status da assinatura, se mapeado
          const novoStatus = STATUS_TO_ASSINATURA[event];
          if (assinaturaId && novoStatus) {
            await supabase
              .from("assinaturas")
              .update({ status: novoStatus })
              .eq("id", assinaturaId);
          }
        }

        // 4) Eventos de assinatura
        if (event.startsWith("SUBSCRIPTION_") && payload.subscription) {
          const s = payload.subscription;
          const novoStatus = STATUS_TO_ASSINATURA[event];
          if (novoStatus) {
            await supabase
              .from("assinaturas")
              .update({
                status: novoStatus,
                proxima_cobranca: s.nextDueDate ?? null,
              })
              .eq("asaas_subscription_id", s.id);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
