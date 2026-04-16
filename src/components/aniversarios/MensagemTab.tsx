import { useState, useEffect, useCallback, useRef } from "react";
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

interface ConfigMensagem {
  id: string;
  mensagem: string;
  imagem_url: string | null;
}

const DEFAULT_MSG =
  "🎂 Feliz aniversário, {nome}! A equipe da clínica deseja a você um dia incrível! 🎉";

export function MensagemTab() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<ConfigMensagem | null>(null);
  const [mensagem, setMensagem] = useState(DEFAULT_MSG);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("config_mensagem")
      .select("id, mensagem, imagem_url")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      const c = data as ConfigMensagem;
      setConfig(c);
      setMensagem(c.mensagem);
      setImagemUrl(c.imagem_url);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

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

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/banner-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("mensagens")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("mensagens").getPublicUrl(path);
      setImagemUrl(pub.publicUrl);
      toast.success("Imagem carregada! Clique em Salvar para confirmar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemoveImage = () => {
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
      const payload = {
        user_id: user.id,
        mensagem: mensagem.trim(),
        imagem_url: imagemUrl,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from("config_mensagem")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
      toast.success("Mensagem salva!");
      fetchConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const previewMsg = mensagem.replace(/{nome}/g, "João");

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
                disabled={uploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "Enviando..." : imagemUrl ? "Trocar" : "Selecionar"}
              </Button>
              {imagemUrl && (
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

      {/* Preview WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
          <CardDescription>
            Como a mensagem aparecerá no WhatsApp do contato
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-[oklch(0.95_0.02_140)] p-4 dark:bg-[oklch(0.25_0.02_140)]">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-[oklch(0.92_0.08_140)] p-2 shadow-sm dark:bg-[oklch(0.4_0.08_140)]">
              {imagemUrl ? (
                <img
                  src={imagemUrl}
                  alt="Banner"
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
          {config && (
            <p className="mt-3 text-xs text-muted-foreground">
              ✓ Configuração salva. Edite e clique em Salvar para atualizar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
