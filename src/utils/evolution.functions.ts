import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const EVOLUTION_STATUS_WEBHOOK_URL =
  "https://n8n.vendavocenegocios.com.br/webhook/evolution-status";

const createInstanceSchema = z.object({
  instanceName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  accessToken: z.string().min(1),
});

const sendMessageSchema = z.object({
  instanceName: z.string().min(1).max(100),
  accessToken: z.string().min(1),
  phone: z.string().min(10).max(20).regex(/^[0-9]+$/),
  message: z.string().min(1).max(2000),
});

const sendMediaSchema = z.object({
  instanceName: z.string().min(1).max(100),
  accessToken: z.string().min(1),
  phone: z.string().min(10).max(20).regex(/^[0-9]+$/),
  caption: z.string().max(2000).optional().default(""),
  mediaUrl: z.string().url().max(2048),
  mediaType: z.enum(["image", "video", "document", "audio"]).default("image"),
  mimetype: z.string().min(1).max(100).optional(),
  fileName: z.string().min(1).max(200).optional(),
});

const instanceNameSchema = z.object({
  instanceName: z.string().min(1).max(100),
  accessToken: z.string().min(1),
});

const statusInstanceNameSchema = z.object({
  instanceName: z.string().min(1).max(100),
  accessToken: z.string().min(1),
});

async function getAuthenticatedSupabase(accessToken: string) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: userData, error } = await supabase.auth.getUser();

  if (error || !userData?.user) {
    throw new Error("Usuário não autenticado");
  }

  return { supabase, user: userData.user };
}

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

function isAlreadyInUseResponse(status: number, payload: unknown) {
  // Evolution API costuma retornar 403 ou 409 quando o nome já existe
  if (status !== 403 && status !== 409) return false;
  if (!payload) return false;

  // Caso payload seja string crua
  if (typeof payload === "string") {
    return /already in use|já está em uso|already exists|name .* in use/i.test(
      payload,
    );
  }

  if (typeof payload !== "object") return false;

  const response = payload as {
    response?: { message?: string[] | string };
    message?: string[] | string;
    error?: string;
  };

  const rawMessage =
    response.response?.message ?? response.message ?? response.error;
  const messages = Array.isArray(rawMessage) ? rawMessage : [rawMessage];

  return messages.some(
    (message) =>
      typeof message === "string" &&
      /already in use|já está em uso|already exists|name .* in use/i.test(
        message,
      ),
  );
}

async function ensureInstanceExists(instanceName: string, accessToken: string) {
  const { supabase } = await getAuthenticatedSupabase(accessToken);

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
      console.log("[Evolution] createInstance →", { url, instanceName: data.instanceName });
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
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      console.log("[Evolution] createInstance ←", res.status, typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300));

      const alreadyInUse = isAlreadyInUseResponse(res.status, body);

      if (!res.ok && !alreadyInUse) {
        return {
          success: false,
          error: `Evolution API erro [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }

      if (alreadyInUse) {
        console.warn("[Evolution] createInstance: nome já existe na Evolution, reutilizando instância", {
          instanceName: data.instanceName,
        });
      }

      // Extrai dados úteis da resposta
      const qr = extractQrCode(body);
      const instanceId =
        typeof body === "object" && body !== null
          ? ((body as { instance?: { instanceId?: string } }).instance?.instanceId ?? null)
          : null;

      const { supabase, user } = await getAuthenticatedSupabase(data.accessToken);
      const userId = user.id;
      const payload = {
        user_id: userId,
        instance_name: data.instanceName,
        instance_id: instanceId,
        status: "disconnected",
      };

      // Verifica se já existe registro para esse usuário
      const { data: existing, error: selectError } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (selectError) {
        console.error("[Evolution] createInstance: erro ao consultar whatsapp_instances", selectError);
        return {
          success: false,
          error: `Erro ao consultar banco: ${selectError.message}`,
        };
      }

      const dbResult = existing
        ? await supabase
            .from("whatsapp_instances")
            .update(payload)
            .eq("id", existing.id)
        : await supabase.from("whatsapp_instances").insert(payload);

      if (dbResult.error) {
        console.error(
          "[Evolution] createInstance: falha ao salvar instância no banco",
          { userId, instanceName: data.instanceName, error: dbResult.error },
        );
        return {
          success: false,
          error: `Instância criada na Evolution mas falhou ao salvar no banco: ${dbResult.error.message}`,
        };
      }

      console.log("[Evolution] createInstance: instância salva no banco", {
        userId,
        instanceName: data.instanceName,
      });

      // Configura webhook automaticamente para receber status de mensagens.
      // Não bloqueia o retorno em caso de falha — o usuário ainda consegue
      // escanear o QR; o webhook pode ser reconfigurado depois.
      try {
        const webhookPayload = {
          webhook: {
            url: EVOLUTION_STATUS_WEBHOOK_URL,
            enabled: true,
            webhook_by_events: false,
            webhook_base64: false,
            events: ["MESSAGES_UPDATE", "MESSAGES_STATUS"],
          },
        };

        const webhookRes = await fetch(
          `${url}/webhook/set/${data.instanceName}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: key,
            },
            body: JSON.stringify(webhookPayload),
          },
        );
        const webhookRaw = await webhookRes.text();
        console.log(
          "[Evolution] webhook/set ←",
          webhookRes.status,
          webhookRaw.slice(0, 300),
        );
        if (!webhookRes.ok) {
          console.warn(
            "[Evolution] createInstance: falha ao configurar webhook (não bloqueante)",
            { instanceName: data.instanceName, status: webhookRes.status },
          );
        }
      } catch (webhookError) {
        console.warn(
          "[Evolution] createInstance: erro ao configurar webhook (não bloqueante)",
          webhookError,
        );
      }

      return { success: true, data: body, qrCode: qr };
    } catch (error) {
      console.error("[Evolution] createInstance error", error);
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

      console.log("[Evolution] getQrCode →", `${url}/instance/connect/${data.instanceName}`);
      const res = await fetch(`${url}/instance/connect/${data.instanceName}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
      });
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      console.log("[Evolution] getQrCode ←", res.status, typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400));

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
      await ensureInstanceExists(data.instanceName, data.accessToken);

      const res = await fetch(
        `${url}/instance/connectionState/${data.instanceName}`,
        {
          method: "GET",
          headers: { apikey: key },
        },
      );
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      console.log(
        "[Evolution] connectionState ←",
        res.status,
        typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300),
      );
      if (!res.ok) {
        return {
          success: false,
          error: `Error [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }
      // Extrai o número conectado (ownerJid) — usado para impedir auto-envio
      let ownerNumber: string | null = null;
      if (typeof body === "object" && body !== null) {
        const b = body as {
          instance?: { owner?: string; ownerJid?: string; wuid?: string };
          owner?: string;
          ownerJid?: string;
          wuid?: string;
        };
        const owner =
          b.instance?.ownerJid ??
          b.instance?.owner ??
          b.instance?.wuid ??
          b.ownerJid ??
          b.owner ??
          b.wuid ??
          null;
        if (typeof owner === "string") {
          // ownerJid vem como "5521981089100@s.whatsapp.net"
          ownerNumber = owner.split("@")[0].replace(/\D/g, "") || null;
        }
      }
      return { success: true, data: body, ownerNumber };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

// Força reconexão da Evolution API SEM recriar a instância.
// Usa o mesmo endpoint que o frontend usa para obter o QR.
// Configura (ou reconfigura) o webhook de status da Evolution API para
// uma instância já existente. Útil para instâncias criadas antes da
// configuração automática de webhook ter sido implementada.
export const configureInstanceWebhook = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof statusInstanceNameSchema>) =>
    statusInstanceNameSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      await ensureInstanceExists(data.instanceName, data.accessToken);

      const webhookPayload = {
        webhook: {
          url: EVOLUTION_STATUS_WEBHOOK_URL,
          enabled: true,
          webhook_by_events: false,
          webhook_base64: false,
          events: ["MESSAGES_UPDATE", "MESSAGES_STATUS"],
        },
      };

      const endpoint = `${url}/webhook/set/${data.instanceName}`;
      console.log("[Evolution] webhook/set →", endpoint, JSON.stringify(webhookPayload));

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
        body: JSON.stringify(webhookPayload),
      });
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      console.log(
        "[Evolution] webhook/set ←",
        res.status,
        typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400),
      );

      if (!res.ok) {
        return {
          success: false,
          error: `Erro ao configurar webhook [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }

      return {
        success: true,
        endpoint,
        events: ["MESSAGES_UPDATE", "MESSAGES_STATUS"],
        webhookUrl: EVOLUTION_STATUS_WEBHOOK_URL,
        data: body,
      };
    } catch (error) {
      console.error("[Evolution] configureInstanceWebhook error", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

export const reconnectInstance = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof statusInstanceNameSchema>) =>
    statusInstanceNameSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      await ensureInstanceExists(data.instanceName, data.accessToken);

      console.log("[Evolution] reconnect →", `${url}/instance/connect/${data.instanceName}`);
      const res = await fetch(`${url}/instance/connect/${data.instanceName}`, {
        method: "GET",
        headers: { apikey: key },
      });
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      console.log(
        "[Evolution] reconnect ←",
        res.status,
        typeof body === "string" ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300),
      );
      if (!res.ok) {
        return {
          success: false,
          error: `Error [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }
      const qrCode = extractQrCode(body);
      const state =
        typeof body === "object" && body !== null
          ? ((body as { instance?: { state?: string }; state?: string }).instance?.state ??
            (body as { state?: string }).state)
          : undefined;
      return { success: true, data: body, base64: qrCode, state };
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
      await ensureInstanceExists(data.instanceName, data.accessToken);

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
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      if (!res.ok) {
        return {
          success: false,
          error: `Error [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }

      const providerStatus =
        typeof body === "object" && body !== null && "status" in body
          ? String((body as { status?: unknown }).status ?? "")
          : "";

      const messageId =
        typeof body === "object" && body !== null && "key" in body
          ? ((body as { key?: { id?: string } }).key?.id ?? null)
          : null;

      const remoteJid =
        typeof body === "object" && body !== null && "key" in body
          ? ((body as { key?: { remoteJid?: string } }).key?.remoteJid ?? null)
          : null;

      return {
        success: true,
        data: body,
        accepted: true,
        providerStatus,
        messageId,
        remoteJid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });

function inferMimetype(mediaUrl: string, fallback?: string) {
  if (fallback) return fallback;
  const lower = mediaUrl.toLowerCase().split("?")[0];
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "image/jpeg";
}

function inferFileName(mediaUrl: string, fallback?: string) {
  if (fallback) return fallback;
  try {
    const u = new URL(mediaUrl);
    const last = u.pathname.split("/").pop();
    return last || "imagem.jpg";
  } catch {
    return "imagem.jpg";
  }
}

export const sendMediaMessage = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof sendMediaSchema>) =>
    sendMediaSchema.parse(input),
  )
  .handler(async ({ data }) => {
    const { url, key } = getEvolutionConfig();
    try {
      await ensureInstanceExists(data.instanceName, data.accessToken);

      const payload = {
        number: data.phone,
        mediatype: data.mediaType,
        mimetype: inferMimetype(data.mediaUrl, data.mimetype),
        caption: data.caption ?? "",
        media: data.mediaUrl,
        fileName: inferFileName(data.mediaUrl, data.fileName),
      };

      console.log("[Evolution] sendMedia →", {
        url: `${url}/message/sendMedia/${data.instanceName}`,
        number: data.phone,
        mediaUrl: data.mediaUrl,
      });

      const res = await fetch(
        `${url}/message/sendMedia/${data.instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: key,
          },
          body: JSON.stringify(payload),
        },
      );
      const rawBody = await res.text();
      const body = parseJsonSafely(rawBody) ?? rawBody;
      console.log(
        "[Evolution] sendMedia ←",
        res.status,
        typeof body === "string" ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400),
      );

      if (!res.ok) {
        return {
          success: false,
          error: `Error [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`,
        };
      }

      const providerStatus =
        typeof body === "object" && body !== null && "status" in body
          ? String((body as { status?: unknown }).status ?? "")
          : "";

      const messageId =
        typeof body === "object" && body !== null && "key" in body
          ? ((body as { key?: { id?: string } }).key?.id ?? null)
          : null;

      const remoteJid =
        typeof body === "object" && body !== null && "key" in body
          ? ((body as { key?: { remoteJid?: string } }).key?.remoteJid ?? null)
          : null;

      return {
        success: true,
        data: body,
        accepted: true,
        providerStatus,
        messageId,
        remoteJid,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  });
