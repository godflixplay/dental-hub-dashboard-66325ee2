export const ANIVERSARIOS_REQUEST_TIMEOUT_MS = 12000;

export async function withRequestTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  timeoutMs = ANIVERSARIOS_REQUEST_TIMEOUT_MS,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `${label} demorou mais que ${Math.round(timeoutMs / 1000)}s para responder.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function getAniversariosErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? "")
          : "Erro inesperado.";

  if (/Could not find the table 'public\.config_mensagem'/i.test(message)) {
    return "A tabela config_mensagem ainda não existe no Supabase. Rode a migração de Aniversários.";
  }

  if (/Could not find the table 'public\.envios'/i.test(message)) {
    return "A tabela envios ainda não existe no Supabase. Rode a migração de Aniversários.";
  }

  if (/Could not find the table 'public\.contatos'/i.test(message)) {
    return "A tabela contatos não está disponível no Supabase.";
  }

  if (/Could not find the table 'public\.whatsapp_instances'/i.test(message)) {
    return "A tabela whatsapp_instances não está disponível no Supabase.";
  }

  if (/Bucket not found/i.test(message)) {
    return "O bucket mensagens não existe no Supabase Storage. Rode a migração de Aniversários.";
  }

  return message;
}