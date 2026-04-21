import { describe, it, expect, vi } from "vitest";
import {
  BUCKET_NAME,
  assertPersistableImageUrl,
  buildImagePath,
  sanitizeExt,
  uploadInstanceImage,
  withCacheBuster,
  type StorageBucketLike,
  type StorageClientLike,
} from "./imagem-upload";

function makeFile(name: string, type = "image/png", size = 1024): File {
  // jsdom/node: File aceita partes + nome + opts.
  return new File([new Uint8Array(size)], name, { type });
}

function makeStorage(opts: {
  uploadError?: string;
  listFiles?: string[];
  publicUrl?: string;
}): {
  storage: StorageClientLike;
  bucket: StorageBucketLike;
  removed: string[][];
  uploadedPaths: string[];
} {
  const removed: string[][] = [];
  const uploadedPaths: string[] = [];
  const bucket: StorageBucketLike = {
    upload: vi.fn(async (path: string) => {
      uploadedPaths.push(path);
      return {
        error: opts.uploadError ? { message: opts.uploadError } : null,
      };
    }),
    list: vi.fn(async () => ({
      data: (opts.listFiles ?? []).map((name) => ({ name })),
      error: null,
    })),
    remove: vi.fn(async (paths: string[]) => {
      removed.push(paths);
      return { error: null };
    }),
    getPublicUrl: vi.fn((path: string) => ({
      data: {
        publicUrl:
          opts.publicUrl ??
          `https://example.supabase.co/storage/v1/object/public/${BUCKET_NAME}/${path}`,
      },
    })),
  };
  const storage: StorageClientLike = { from: vi.fn(() => bucket) };
  return { storage, bucket, removed, uploadedPaths };
}

describe("sanitizeExt", () => {
  it("normaliza extensão para minúsculas alfanuméricas", () => {
    expect(sanitizeExt("foto.PNG")).toBe("png");
    expect(sanitizeExt("foto.JpEg")).toBe("jpeg");
    expect(sanitizeExt("foto.we!bp")).toBe("webp");
  });
  it("usa png como fallback", () => {
    expect(sanitizeExt(undefined)).toBe("png");
    expect(sanitizeExt("")).toBe("png");
    expect(sanitizeExt("semponto")).toBe("png");
    expect(sanitizeExt("foto.")).toBe("png");
  });
});

describe("buildImagePath", () => {
  it("compõe path estável {userId}/{instanceName}/imagem.{ext}", () => {
    expect(buildImagePath("u1", "MinhaInst", "x.png")).toBe(
      "u1/MinhaInst/imagem.png",
    );
    expect(buildImagePath("u1", "MinhaInst", "x.WEBP")).toBe(
      "u1/MinhaInst/imagem.webp",
    );
  });
  it("é determinístico para o mesmo input", () => {
    const a = buildImagePath("u1", "Inst", "a.jpg");
    const b = buildImagePath("u1", "Inst", "outra.jpg");
    expect(a).toBe(b);
  });
  it("rejeita userId/instanceName vazio", () => {
    expect(() => buildImagePath("", "x", "a.png")).toThrow();
    expect(() => buildImagePath("u1", "", "a.png")).toThrow();
  });
});

describe("withCacheBuster", () => {
  it("anexa ?v=<timestamp>", () => {
    expect(withCacheBuster("https://x/y.png", 1234)).toBe(
      "https://x/y.png?v=1234",
    );
  });
  it("recusa URL vazia (proteção contra null silencioso)", () => {
    expect(() => withCacheBuster("", 1)).toThrow();
  });
});

describe("assertPersistableImageUrl", () => {
  it("permite null quando NÃO há upload pendente (usuário removeu imagem)", () => {
    expect(() => assertPersistableImageUrl(null, false)).not.toThrow();
  });
  it("permite URL válida com upload pendente", () => {
    expect(() =>
      assertPersistableImageUrl("https://x/y.png?v=1", true),
    ).not.toThrow();
  });
  it("BLOQUEIA gravar null quando há upload pendente", () => {
    expect(() => assertPersistableImageUrl(null, true)).toThrow(/null/i);
    expect(() => assertPersistableImageUrl("", true)).toThrow();
  });
});

describe("uploadInstanceImage", () => {
  it("faz upload no path estável, retorna URL pública com cache-buster", async () => {
    const { storage, uploadedPaths } = makeStorage({});
    const url = await uploadInstanceImage({
      userId: "user-1",
      instanceName: "DentalHubTeste",
      file: makeFile("foto.png"),
      storage,
      now: 9999,
    });

    expect(uploadedPaths).toEqual(["user-1/DentalHubTeste/imagem.png"]);
    expect(url).toMatch(/imagens-whatsapp\/user-1\/DentalHubTeste\/imagem\.png/);
    expect(url).toMatch(/\?v=9999$/);
    expect(url).not.toBe("");
  });

  it("nunca devolve null/vazio quando o upload tem sucesso", async () => {
    const { storage } = makeStorage({});
    const url = await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("a.webp", "image/webp"),
      storage,
    });
    expect(url).toBeTruthy();
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(10);
  });

  it("propaga erro se o upload falhar (não devolve URL nem null)", async () => {
    const { storage } = makeStorage({ uploadError: "Bucket not found" });
    await expect(
      uploadInstanceImage({
        userId: "u",
        instanceName: "i",
        file: makeFile("a.png"),
        storage,
      }),
    ).rejects.toThrow(/Bucket not found/);
  });

  it("limpa imagens antigas com extensão diferente do upload atual", async () => {
    const { storage, removed } = makeStorage({
      listFiles: ["imagem.png", "imagem.jpg", "outro.txt"],
    });
    await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("nova.webp", "image/webp"),
      storage,
    });
    // Remove .png e .jpg, MAS não remove o .webp recém-enviado nem outros arquivos.
    expect(removed).toHaveLength(1);
    expect(removed[0]).toEqual(
      expect.arrayContaining(["u/i/imagem.png", "u/i/imagem.jpg"]),
    );
    expect(removed[0]).not.toContain("u/i/imagem.webp");
    expect(removed[0]).not.toContain("u/i/outro.txt");
  });

  it("não chama remove() quando não há arquivos antigos", async () => {
    const { storage, bucket, removed } = makeStorage({
      listFiles: ["imagem.png"],
    });
    await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("foto.png"),
      storage,
    });
    expect(removed).toHaveLength(0);
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it("path permanece estável entre uploads consecutivos do mesmo usuário/instância", async () => {
    const { storage, uploadedPaths } = makeStorage({});
    await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("a.png"),
      storage,
      now: 1,
    });
    await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("b.png"),
      storage,
      now: 2,
    });
    expect(uploadedPaths[0]).toBe(uploadedPaths[1]);
  });

  it("URLs consecutivas têm cache-busters diferentes", async () => {
    const { storage } = makeStorage({});
    const u1 = await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("a.png"),
      storage,
      now: 100,
    });
    const u2 = await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("a.png"),
      storage,
      now: 200,
    });
    expect(u1).not.toBe(u2);
    expect(u1).toContain("?v=100");
    expect(u2).toContain("?v=200");
  });

  it("usa upsert:true e cacheControl:0 para sobrescrever sem cache stale", async () => {
    const { storage, bucket } = makeStorage({});
    await uploadInstanceImage({
      userId: "u",
      instanceName: "i",
      file: makeFile("a.png"),
      storage,
    });
    expect(bucket.upload).toHaveBeenCalledWith(
      "u/i/imagem.png",
      expect.anything(),
      expect.objectContaining({ upsert: true, cacheControl: "0" }),
    );
  });

  it("isolamento multi-tenant: usuários diferentes nunca compartilham path", async () => {
    const { storage, uploadedPaths } = makeStorage({});
    await uploadInstanceImage({
      userId: "user-A",
      instanceName: "shared-name",
      file: makeFile("a.png"),
      storage,
    });
    await uploadInstanceImage({
      userId: "user-B",
      instanceName: "shared-name",
      file: makeFile("a.png"),
      storage,
    });
    expect(uploadedPaths[0]).toContain("user-A/");
    expect(uploadedPaths[1]).toContain("user-B/");
    expect(uploadedPaths[0]).not.toBe(uploadedPaths[1]);
  });
});
