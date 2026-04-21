/**
 * Lógica pura de upload/persistência de imagem por instância WhatsApp.
 *
 * Extraída do componente para permitir teste automatizado sem React/DOM.
 *
 * Garantias verificadas pelos testes em `imagem-upload.test.ts`:
 *   1. O path é SEMPRE `{userId}/{instanceName}/imagem.{ext}` (estável por instância).
 *   2. `imagem_url` resultante NUNCA é null quando há um File válido.
 *   3. Falha no upload propaga erro (nunca devolve URL parcial/null silenciosa).
 *   4. URL pública sempre carrega cache-buster `?v=<timestamp>`.
 *   5. `persistImagemUrl` recusa gravar `null` quando há intenção de upload.
 */

export interface StorageUploadResult {
  error: { message: string } | null;
}

export interface StorageListItem {
  name: string;
}

export interface StorageListResult {
  data: StorageListItem[] | null;
  error: { message: string } | null;
}

export interface StorageRemoveResult {
  error: { message: string } | null;
}

export interface PublicUrlResult {
  data: { publicUrl: string };
}

export interface StorageBucketLike {
  upload: (
    path: string,
    file: File | Blob,
    opts: { upsert: boolean; contentType?: string; cacheControl?: string },
  ) => Promise<StorageUploadResult>;
  list: (folder: string) => Promise<StorageListResult>;
  remove: (paths: string[]) => Promise<StorageRemoveResult>;
  getPublicUrl: (path: string) => PublicUrlResult;
}

export interface StorageClientLike {
  from: (bucket: string) => StorageBucketLike;
}

export const BUCKET_NAME = "imagens-whatsapp";

/** Sanitiza extensão para path estável: apenas [a-z0-9]. */
export function sanitizeExt(rawName: string | undefined | null): string {
  if (!rawName) return "png";
  // Sem ponto = sem extensão.
  if (!rawName.includes(".")) return "png";
  const tail = rawName.split(".").pop() ?? "";
  const cleaned = tail.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned || "png";
}

/** Compõe o path determinístico por instância. */
export function buildImagePath(
  userId: string,
  instanceName: string,
  fileName: string,
): string {
  if (!userId) throw new Error("userId obrigatório para compor path");
  if (!instanceName)
    throw new Error("instanceName obrigatório para compor path");
  const ext = sanitizeExt(fileName);
  return `${userId}/${instanceName}/imagem.${ext}`;
}

/** Adiciona cache-buster — n8n/Evolution sempre vão buscar a versão nova. */
export function withCacheBuster(publicUrl: string, now: number): string {
  if (!publicUrl) throw new Error("publicUrl vazio — não permitido");
  return `${publicUrl}?v=${now}`;
}

export interface UploadInstanceImageInput {
  userId: string;
  instanceName: string;
  file: File;
  storage: StorageClientLike;
  now?: number;
}

/**
 * Faz upload (upsert), limpa imagens com extensão antiga e retorna URL pública.
 * Erro de upload é re-lançado — caller NUNCA deve persistir null neste caso.
 */
export async function uploadInstanceImage(
  input: UploadInstanceImageInput,
): Promise<string> {
  const { userId, instanceName, file, storage } = input;
  const now = input.now ?? Date.now();

  if (!file) throw new Error("Arquivo obrigatório para upload");

  const path = buildImagePath(userId, instanceName, file.name);
  const bucket = storage.from(BUCKET_NAME);

  const upload = await bucket.upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
    cacheControl: "0",
  });
  if (upload.error) {
    throw new Error(upload.error.message || "Falha no upload");
  }

  // Limpa arquivos antigos com outra extensão (ex.: .png → .webp).
  const folder = `${userId}/${instanceName}`;
  const list = await bucket.list(folder);
  if (!list.error && list.data) {
    const toRemove = list.data
      .filter((f) => f.name.startsWith("imagem."))
      .map((f) => `${folder}/${f.name}`)
      .filter((p) => p !== path);
    if (toRemove.length > 0) {
      await bucket.remove(toRemove);
    }
  }

  const { data } = bucket.getPublicUrl(path);
  return withCacheBuster(data.publicUrl, now);
}

/** Decisão pura: posso gravar este `imagem_url`? */
export function assertPersistableImageUrl(
  url: string | null,
  hadPendingFile: boolean,
): asserts url is string | null {
  // Se o usuário escolheu novo arquivo, NUNCA pode persistir null.
  if (hadPendingFile && (url === null || url === undefined || url === "")) {
    throw new Error(
      "imagem_url inválida: upload pendente exige URL pública válida.",
    );
  }
}
