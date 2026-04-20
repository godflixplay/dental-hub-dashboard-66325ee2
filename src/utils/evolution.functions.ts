import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const createInstanceSchema = z.object({
  instanceName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  accessToken: z.string().min(1),
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

      // Persiste no banco usando o token do usuário (RLS garante isolamento)
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
      });

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error("[Evolution] createInstance: falha ao obter usuário", userError);
        return {
          success: false,
          error: "Não foi possível identificar o usuário autenticado.",
        };
      }

      const userId = userData.user.id;
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
