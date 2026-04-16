import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
});

function getEvolutionConfig() {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL is not configured");
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY is not configured");
  return { url: url.replace(/\/$/, ""), key };
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
      const res = await fetch(
        `${url}/instance/connect/${data.instanceName}`,
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

export const getInstanceStatus = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof instanceNameSchema>) =>
    instanceNameSchema.parse(input),
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
