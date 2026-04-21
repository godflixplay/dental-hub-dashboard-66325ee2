import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const N8N_TEST_WEBHOOK_URL =
  "https://n8n.vendavocenegocios.com.br/webhook-test/enviar-teste";

const triggerSchema = z.object({
  accessToken: z.string().min(1),
  nome: z.string().min(1).max(200),
  telefone: z.string().min(8).max(20),
  mensagem: z.string().min(1).max(4000),
});

async function getAuthenticatedSupabase(accessToken: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    throw new Error("Usuário não autenticado");
  }
  return { supabase, user: userData.user };
}

function getEvolutionConfig() {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL is not configured");
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY is not configured");
  const cleaned = url.replace(/\/$/, "").replace(/\/manager$/i, "");
  return { url: cleaned, key };
}

/**
 * Normaliza telefone para o padrão BR esperado pelo n8n/Evolution:
 *  - remove qualquer caractere não numérico
 *  - remove zeros à esquerda
 *  - garante DDI 55 quando o número tem 10 ou 11 dígitos
 *  - retorna no formato 55DDXXXXXXXXX (12 ou 13 dígitos)
 */
function normalizePhoneServer(input: string): string {
  let digits = String(input ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) throw new Error("Telefone vazio.");
  if (!(digits.startsWith("55") && (digits.length === 12 || digits.length === 13))) {
    if (digits.length === 10 || digits.length === 11) {
      digits = "55" + digits;
    }
  }
  if (digits.length !== 12 && digits.length !== 13 || !digits.startsWith("55")) {
    throw new Error(
      `Telefone inválido após normalização: ${digits}. Use formato 55DDXXXXXXXXX.`,
    );
  }
  return digits;
}

/** Substitui {nome} (e variações com espaço) pelo nome final, sem deixar variáveis cruas. */
function renderMensagem(template: string, nome: string): string {
  return String(template ?? "")
    .replace(/\{\s*nome\s*\}/gi, nome)
    .trim();
}

/** Valida se a URL de imagem é pública/usável; retorna null se inválida. */
function sanitizeImagemUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

/**
 * Aciona o webhook do n8n responsável pelo envio de teste.
 *
 * Padroniza TODOS os campos antes de enviar:
 *  - telefone → 55DDXXXXXXXXX (apenas dígitos)
 *  - mensagem → texto final, com {nome} já substituído
 *  - nome_instancia → obrigatório, nunca null
 *  - imagem_url → URL pública (https) ou ausência explícita
 *
 * O n8n é responsável por executar o envio na Evolution API e inserir
 * o registro em `envios_whatsapp`. O frontend escuta via Realtime.
 */
export const triggerN8nTestWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof triggerSchema>) =>
    triggerSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { supabase, user } = await getAuthenticatedSupabase(data.accessToken);

    const { data: instance, error: instanceError } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, instance_id, imagem_url")
      .eq("user_id", user.id)
      .maybeSingle();

    if (instanceError) {
      return {
        success: false as const,
        error: `Erro ao buscar instância: ${instanceError.message}`,
      };
    }

    if (!instance) {
      return {
        success: false as const,
        error: "Nenhuma instância WhatsApp encontrada para este usuário.",
      };
    }

    const nomeInstancia = instance.instance_name?.trim();
    if (!nomeInstancia) {
      return {
        success: false as const,
        error: "Instância sem nome (instance_name) — reconecte o WhatsApp.",
      };
    }

    let telefone: string;
    try {
      telefone = normalizePhoneServer(data.telefone);
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "Telefone inválido.",
      };
    }

    const nome = data.nome.trim() || "paciente";
    const mensagem = renderMensagem(data.mensagem, nome);
    if (!mensagem) {
      return {
        success: false as const,
        error: "Mensagem vazia após renderização.",
      };
    }

    const imagemUrl = sanitizeImagemUrl(instance.imagem_url);

    const { url: apiUrl, key: token } = getEvolutionConfig();

    // Payload final padronizado — nenhum campo obrigatório vai como null/undefined.
    const payload = {
      nome,
      telefone,
      mensagem,
      nome_instancia: nomeInstancia,
      user_id: user.id,
      imagem_url: imagemUrl ?? "",
      // Campos auxiliares mantidos para o n8n usar na chamada à Evolution API
      instancia_id: instance.instance_id ?? "",
      api_url: apiUrl,
      token,
    };

    try {
      const res = await fetch(N8N_TEST_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();

      if (!res.ok) {
        return {
          success: false as const,
          error: `Webhook n8n respondeu ${res.status}: ${text.slice(0, 500)}`,
          status: res.status,
        };
      }

      return {
        success: true as const,
        status: res.status,
        response: text.slice(0, 1000),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false as const,
        error: `Falha ao chamar webhook n8n: ${message}`,
      };
    }
  });
