import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const N8N_TEST_WEBHOOK_URL =
  "https://n8n.vendavocenegocios.com.br/webhook-test/enviar-teste";

const triggerSchema = z.object({
  accessToken: z.string().min(1),
  nome: z.string().min(1).max(200),
  telefone: z.string().min(10).max(20).regex(/^[0-9]+$/),
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
 * Aciona o webhook do n8n responsável pelo envio de teste.
 *
 * Monta o payload com dados consolidados da instância do usuário
 * (api_url + token vêm do ambiente do servidor — nunca do client),
 * dispara para o n8n e retorna a resposta.
 *
 * O n8n é responsável por:
 *  - executar o envio na Evolution API
 *  - inserir o registro em `envios_whatsapp` (com user_id correto)
 *
 * O frontend NÃO insere nada no banco; ele apenas escuta a tabela via
 * Realtime e exibe o registro quando o n8n o cria.
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

    const { url: apiUrl, key: token } = getEvolutionConfig();

    const payload = {
      nome: data.nome,
      telefone: data.telefone,
      mensagem: data.mensagem,
      instancia_id: instance.instance_id,
      user_id: user.id,
      api_url: apiUrl,
      token,
      nome_instancia: instance.instance_name,
      imagem_url: instance.imagem_url ?? null,
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
