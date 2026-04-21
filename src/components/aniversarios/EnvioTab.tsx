import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { sendTextMessage, getInstanceStatus } from "@/utils/evolution.functions";
import { normalizePhoneBR } from "@/components/aniversarios/phone-utils";
import { Send, MessageSquare, AlertCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  buildMensagemPreview,
  isMensagemConfigurada,
} from "@/components/aniversarios/mensagem-config";
import {
  getAniversariosErrorMessage,
  withRequestTimeout,
  withEvolutionTimeout,
} from "@/components/aniversarios/request-utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Contato {
  id: string;
  nome: string;
  telefone: string;
}

interface Envio {
  id: string;
  telefone: string;
  nome: string | null;
  status: string;
  erro: string | null;
  data_envio: string;
}

interface ConfigMensagem {
  mensagem: string;
  imagem_url: string | null;
}

export function EnvioTab() {
  const { user } = useAuth();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [config, setConfig] = useState<ConfigMensagem | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<string>("disconnected");
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [selectedContato, setSelectedContato] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customNome, setCustomNome] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [contatosRes, instanceRes, configRes, enviosRes] = await withRequestTimeout(
        Promise.all([
          supabase.from("contatos").select("id, nome, telefone").order("nome"),
          supabase
            .from("whatsapp_instances")
            .select("instance_name, status")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("config_mensagem")
            .select("mensagem, imagem_url")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("envios")
            .select("id, telefone, nome, status, erro, data_envio")
            .eq("user_id", user.id)
            .order("data_envio", { ascending: false })
            .limit(10),
        ]),
        "O carregamento da aba de envio",
      );

      if (contatosRes.error) {
        console.error("[EnvioTab] erro ao carregar contatos", contatosRes.error);
      }
      if (instanceRes.error) {
        console.error("[EnvioTab] erro ao carregar instância", instanceRes.error);
      }
      if (configRes.error) {
        console.error("[EnvioTab] erro ao carregar config_mensagem", configRes.error);
      }
      if (enviosRes.error) {
        console.error("[EnvioTab] erro ao carregar envios", enviosRes.error);
      }

      const firstError =
        contatosRes.error ??
        instanceRes.error ??
        configRes.error ??
        enviosRes.error;

      if (firstError) {
        setLoadError(getAniversariosErrorMessage(firstError));
      }

      setContatos((contatosRes.data as Contato[]) ?? []);
      if (instanceRes.data) {
        const i = instanceRes.data as { instance_name: string; status: string };
        setInstanceName(i.instance_name);
        setInstanceStatus(i.status);
      } else {
        setInstanceName(null);
        setInstanceStatus("disconnected");
      }
      setConfig((configRes.data as ConfigMensagem) ?? null);
      setEnvios((enviosRes.data as Envio[]) ?? []);
    } catch (error) {
      setLoadError(getAniversariosErrorMessage(error));
      setContatos([]);
      setConfig(null);
      setEnvios([]);
      setInstanceName(null);
      setInstanceStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSend = async () => {
    if (!user) return;
    if (!instanceName) {
      toast.error("Conecte o WhatsApp primeiro");
      return;
    }
    if (!isMensagemConfigurada(config)) {
      toast.error("Configure sua mensagem na aba Mensagem");
      return;
    }

    const mensagemTemplate = config?.mensagem?.trim();
    if (!mensagemTemplate) {
      toast.error("Configure sua mensagem na aba Mensagem");
      return;
    }

    const contato = contatos.find((c) => c.id === selectedContato);
    const phone = contato?.telefone || customPhone.replace(/\D/g, "");
    const nome = contato?.nome || customNome || "paciente";

    if (!phone) {
      toast.error("Selecione um contato ou digite um número");
      return;
    }

    setSending(true);
    const finalMessage = buildMensagemPreview(mensagemTemplate, nome);

    try {
      const result = await withRequestTimeout(
        sendTextMessage({
          data: { instanceName, phone, message: finalMessage },
        }),
        "O envio da mensagem",
      );

      const status = result.success ? "pendente" : "erro";
      const erro = result.success
        ? result.providerStatus
          ? `Evolution aceitou a mensagem com status ${result.providerStatus}. A entrega final no WhatsApp ainda não foi confirmada.`
          : "Evolution aceitou a mensagem, mas a entrega final no WhatsApp ainda não foi confirmada."
        : (result.error ?? "Erro desconhecido");

      await withRequestTimeout(
        supabase.from("envios").insert({
          user_id: user.id,
          contato_id: contato?.id ?? null,
          telefone: phone,
          nome,
          status,
          erro,
        }),
        "O registro do histórico de envio",
      );

      if (result.success) {
        toast.success(`Mensagem aceita pela Evolution para ${nome}.`);
        toast.info("Ainda falta confirmação real de entrega no WhatsApp.");
      } else {
        toast.error(erro ?? "Erro ao enviar");
      }
      await fetchAll();
    } catch (err) {
      const msg = getAniversariosErrorMessage(err);
      await withRequestTimeout(
        supabase.from("envios").insert({
          user_id: user.id,
          contato_id: contato?.id ?? null,
          telefone: phone,
          nome,
          status: "erro",
          erro: msg,
        }),
        "O registro do erro de envio",
      ).catch(() => undefined);
      toast.error(msg);
      await fetchAll();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const hasConfiguredMessage = isMensagemConfigurada(config);
  const canSend = instanceStatus === "connected" && hasConfiguredMessage;

  return (
    <div className="space-y-4">
      {loadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar a aba</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Envio de Teste</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={
                  instanceStatus === "connected" ? "default" : "destructive"
                }
              >
                {instanceStatus === "connected"
                  ? "WhatsApp Conectado"
                  : "WhatsApp Desconectado"}
              </Badge>
              <Badge variant={hasConfiguredMessage ? "default" : "destructive"}>
                {hasConfiguredMessage
                  ? "Mensagem Configurada"
                  : "Mensagem Não Configurada"}
              </Badge>
            </div>
          </div>
          <CardDescription>
            Envie uma mensagem de teste para verificar se tudo está funcionando
          </CardDescription>
        </CardHeader>
      </Card>

      {!hasConfiguredMessage && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="text-sm">
              Você ainda não configurou sua mensagem de aniversário. Vá até a
              aba <strong>Mensagem</strong> para definir o texto e a imagem.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Enviar Mensagem
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Selecionar Contato</Label>
            <Select
              value={selectedContato}
              onValueChange={(v) => {
                setSelectedContato(v);
                setCustomPhone("");
                setCustomNome("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um contato..." />
              </SelectTrigger>
              <SelectContent>
                {contatos.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} — {c.telefone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label>Ou digite um número</Label>
              <Input
                placeholder="5511999999999"
                value={customPhone}
                onChange={(e) => {
                  setCustomPhone(e.target.value);
                  setSelectedContato("");
                }}
              />
            </div>
            <div>
              <Label>Nome (para {"{nome}"})</Label>
              <Input
                placeholder="João"
                value={customNome}
                onChange={(e) => setCustomNome(e.target.value)}
                disabled={!!selectedContato}
              />
            </div>
          </div>

          {hasConfiguredMessage && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Preview da mensagem:
              </p>
              <p className="whitespace-pre-wrap text-sm">
                {buildMensagemPreview(
                  config?.mensagem,
                  contatos.find((c) => c.id === selectedContato)?.nome ||
                    customNome ||
                    "João",
                )}
              </p>
            </div>
          )}

          <Button onClick={handleSend} disabled={sending || !canSend}>
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Enviando..." : "Enviar Teste"}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Últimos Envios
          </CardTitle>
        </CardHeader>
        <CardContent>
          {envios.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum envio realizado ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envios.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">
                      {new Date(e.data_envio).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>{e.nome ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {e.telefone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          e.status === "enviado"
                            ? "default"
                            : e.status === "pendente"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {e.status}
                      </Badge>
                      {e.erro && (
                        <span
                          className="ml-2 text-xs text-muted-foreground"
                          title={e.erro}
                        >
                          ⓘ
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
