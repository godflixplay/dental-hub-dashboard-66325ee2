import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const createInstanceSchema = z.object({
  instanceName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

const sendMessageSchema = z.object({
  instanceName: z.string().min(1).max(100),
  phone: z.string().min(10).max(20).regex(/^[0-9]+$/),
  message: z.string().min(1).max(2000),
});

const instanceNameSchema = z.object({
  instanceName: z.string().min(1).max(100),
  accessToken: z.string().min(1),
});

const statusInstanceNameSchema = z.object({
  instanceName: z.string().min(1).max(100),
});

function parseJsonSafely(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractQrCode(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  const candidates = [
    data.base64,
    data.qrcode,
    data.qr,
    (data.qrcode as Record<string, unknown> | undefined)?.base64,
    (data.qrcode as Record<string, unknown> | undefined)?.code,
    (data.data as Record<string, unknown> | undefined)?.base64,
    (data.data as Record<string, unknown> | undefined)?.qrcode,
    (data.data as Record<string, unknown> | undefined)?.qr,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

async function ensureInstanceExists(instanceName: string, accessToken: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("id, instance_name")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao validar instância no banco: ${error.message}`);
  }

  if (!data) {
    throw new Error("Instância não encontrada no banco de dados.");
  }

  return data;
}

function getEvolutionConfig() {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL is not configured");
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY is not configured");
  // Remove trailing slash and accidental "/manager" suffix
  const cleaned = url.replace(/\/$/, "").replace(/\/manager$/i, "");
  return { url: cleaned, key };
}

export const createInstance = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof createInstanceSchema>) =>
    createInstanceSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      const res = await fetch(`${url}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
        body: JSON.stringify({
          instanceName: data.instanceName,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: `Evolution API error [${res.status}]: ${JSON.stringify(body)}`,
        };
      }
      return { success: true, data: body };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

export const getQrCode = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof instanceNameSchema>) =>
    instanceNameSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      await ensureInstanceExists(data.instanceName, data.accessToken);

      const res = await fetch(`${url}/instance/connect/${data.instanceName}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
      });
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;

      if (!res.ok) {
        return {
          success: false,
          error:
            res.status === 401
              ? "Falha de autenticação na Evolution API."
              : `Erro ao gerar QR Code [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }

      const qrCode = extractQrCode(body);
      const state =
        typeof body === "object" && body !== null
          ? ((body as { instance?: { state?: string }; state?: string }).instance
              ?.state ?? (body as { state?: string }).state)
          : undefined;

      if (!qrCode && state !== "open") {
        return {
          success: false,
          error:
            "A Evolution API não retornou um QR Code para esta instância. Tente gerar novamente em instantes.",
        };
      }

      return {
        success: true,
        data: {
          raw: body,
          base64: qrCode,
          instance: { state },
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Erro desconhecido ao obter QR Code",
      };
    }
  });

export const getInstanceStatus = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof statusInstanceNameSchema>) =>
    statusInstanceNameSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      const res = await fetch(
        `${url}/instance/connectionState/${data.instanceName}`,
        {
          method: "GET",
          headers: { apikey: key },
        },
      );
      const body = await res.json();
      if (!res.ok) {
        return { success: false, error: `Error [${res.status}]` };
      }
      return { success: true, data: body };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

export const sendTextMessage = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof sendMessageSchema>) =>
    sendMessageSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      const res = await fetch(
        `${url}/message/sendText/${data.instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
          },
          body: JSON.stringify({
            number: data.phone,
            text: data.message,
          }),
        },
      );
      const body = await res.json();
      if (!res.ok) {
        return {
          success: false,
          error: `Error [${res.status}]: ${JSON.stringify(body)}`,
        };
      }
      return { success: true, data: body };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
