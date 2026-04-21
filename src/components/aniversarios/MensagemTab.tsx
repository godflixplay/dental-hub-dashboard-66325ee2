import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MessageSquare, Upload, Save, ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  buildMensagemPreview,
  DEFAULT_MENSAGEM_ANIVERSARIO,
} from "@/components/aniversarios/mensagem-config";
import {
  getAniversariosErrorMessage,
  withRequestTimeout,
} from "@/components/aniversarios/request-utils";

interface ConfigMensagem {
  id: string;
  mensagem: string;
  imagem_url: string | null;
}

export function MensagemTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const fileRef = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState(DEFAULT_MENSAGEM_ANIVERSARIO);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // Garante que o sync com a query só roda 1× por payload novo do servidor.
  const lastSyncedIdRef = useRef<string | null>(null);

  const configQuery = useQuery({
    queryKey: ["aniv:config:full", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase
          .from("config_mensagem")
          .select("id, mensagem, imagem_url")
          .eq("user_id", userId!)
          .maybeSingle(),
        "O carregamento da configuração da mensagem",
      );
      if (error) throw error;
      return (data as ConfigMensagem | null) ?? null;
    },
  });

  // Instância do usuário (para compor o path da imagem por instância e
  // gravar a URL pública em whatsapp_instances.imagem_url).
  const instanceQuery = useQuery({
    queryKey: ["aniv:wpp:instance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase
          .from("whatsapp_instances")
          .select("id, instance_name")
          .eq("user_id", userId!)
          .maybeSingle(),
        "O carregamento da instância do WhatsApp",
      );
      if (error) throw error;
      return (data as { id: string; instance_name: string } | null) ?? null;
    },
  });

  const config = configQuery.data ?? null;

  // Sincroniza o estado local com a config carregada (apenas quando muda
  // o registro que veio do servidor — não a cada render).
  useEffect(() => {
    if (configQuery.isLoading) return;
    const key = config?.id ?? "__none__";
    if (lastSyncedIdRef.current === key) return;
    lastSyncedIdRef.current = key;

    if (config) {
      setMensagem(config.mensagem);
      setImagemUrl(config.imagem_url);
    } else {
      setMensagem(DEFAULT_MENSAGEM_ANIVERSARIO);
      setImagemUrl(null);
    }
    setPendingFile(null);
    setLocalPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }, [config, configQuery.isLoading]);

  useEffect(() => {
    if (configQuery.error) {
      toast.error(getAniversariosErrorMessage(configQuery.error));
    }
  }, [configQuery.error]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }

    setLocalPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setPendingFile(file);
    toast.success("Imagem selecionada! Clique em Salvar para confirmar.");

    if (fileRef.current) fileRef.current.value = "";
  };

  const uploadPendingFile = async () => {
    if (!user || !pendingFile) return imagemUrl;

    const instanceName = instanceQuery.data?.instance_name;
    if (!instanceName) {
      throw new Error(
        "Conecte uma instância do WhatsApp antes de enviar a imagem.",
      );
    }

    const ext = (pendingFile.name.split(".").pop() || "png").toLowerCase();
    // Path: {user_id}/{instance_name}/imagem-{timestamp}.{ext}
    // Timestamp garante URL nova (evita cache do n8n/Evolution ao trocar imagem).
    const path = `${user.id}/${instanceName}/imagem-${Date.now()}.${ext}`;
    const { error: uploadError } = await withRequestTimeout(
      supabase.storage
        .from("imagens-whatsapp")
        .upload(path, pendingFile, {
          upsert: true,
          contentType: pendingFile.type || undefined,
        }),
      "O upload da imagem",
    );

    if (uploadError) {
      console.error("[MensagemTab] erro no upload da imagem", uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("imagens-whatsapp")
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleRemoveImage = () => {
    setLocalPreviewUrl((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
    setPendingFile(null);
    setImagemUrl(null);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!mensagem.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }
    setSaving(true);
    try {
      let nextImagemUrl = imagemUrl;

      if (pendingFile) {
        try {
          nextImagemUrl = await uploadPendingFile();
        } catch {
          toast.warning(
            "A mensagem será salva sem trocar a imagem porque o upload falhou.",
          );
        }
      }

      const payload = {
        user_id: user.id,
        mensagem: mensagem.trim(),
        imagem_url: nextImagemUrl,
        updated_at: new Date().toISOString(),
      };
      const { error } = await withRequestTimeout(
        supabase
          .from("config_mensagem")
          .upsert(payload, { onConflict: "user_id" })
          .select("id, mensagem, imagem_url")
          .single(),
        "O salvamento da configuração",
      );
      if (error) throw error;

      // Espelha a imagem pública também em whatsapp_instances.imagem_url
      // (cada instância carrega a própria URL — consumida pelo n8n).
      const instanceId = instanceQuery.data?.id;
      if (instanceId) {
        const { error: instanceUpdateError } = await withRequestTimeout(
          supabase
            .from("whatsapp_instances")
            .update({ imagem_url: nextImagemUrl })
            .eq("id", instanceId),
          "A atualização da imagem da instância",
        );
        if (instanceUpdateError) {
          console.error(
            "[MensagemTab] erro ao atualizar imagem_url da instância",
            instanceUpdateError,
          );
        }
      }

      // Reseta a flag para forçar re-sync com o novo dado vindo do servidor.
      lastSyncedIdRef.current = null;
      await queryClient.invalidateQueries({
        queryKey: ["aniv:config:full", userId],
      });
      // Também invalida a query usada pela aba Envio para manter consistência.
      await queryClient.invalidateQueries({
        queryKey: ["aniv:config", userId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["aniv:wpp:instance", userId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["aniv:instance", userId],
      });
      setPendingFile(null);
      setLocalPreviewUrl((current) => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return null;
      });
      toast.success("Mensagem salva!");
    } catch (err) {
      console.error("[MensagemTab] erro ao salvar configuração", err);
      toast.error(getAniversariosErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (configQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const previewMsg = buildMensagemPreview(mensagem, "João");
  const previewImage = localPreviewUrl ?? imagemUrl;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Mensagem de Aniversário
          </CardTitle>
          <CardDescription>
            Configure a mensagem que será enviada para seus contatos no
            aniversário deles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Texto da mensagem</Label>
            <Textarea
              rows={6}
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Digite sua mensagem..."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use <code className="rounded bg-muted px-1">{"{nome}"}</code> para
              inserir o nome do contato automaticamente.
            </p>
          </div>

          <div>
            <Label>Imagem (opcional)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={saving}
              >
                <Upload className="mr-2 h-4 w-4" />
                {previewImage ? "Trocar" : "Selecionar"}
              </Button>
              {previewImage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveImage}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Formatos aceitos: JPG, PNG, WEBP. Máx 5MB.
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
          <CardDescription>
            Como a mensagem aparecerá no WhatsApp do contato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm border bg-background p-2 shadow-sm">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Preview da imagem da mensagem de aniversário"
                  loading="lazy"
                  className="mb-2 max-h-64 w-full rounded object-cover"
                />
              ) : (
                <div className="mb-2 flex h-32 items-center justify-center rounded bg-muted/50 text-xs text-muted-foreground">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Sem imagem
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {previewMsg}
              </p>
              <p className="mt-1 text-right text-[10px] text-muted-foreground">
                12:34 ✓✓
              </p>
            </div>
          </div>
          {pendingFile ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Imagem selecionada. Clique em Salvar para aplicar essa versão.
            </p>
          ) : config ? (
            <p className="mt-3 text-xs text-muted-foreground">
              ✓ Configuração salva. Edite e clique em Salvar para atualizar.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
