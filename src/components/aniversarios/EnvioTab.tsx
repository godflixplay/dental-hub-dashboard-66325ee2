import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  sendTextMessage,
  sendMediaMessage,
  getInstanceStatus,
  reconnectInstance,
} from "@/utils/evolution.functions";
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
  const { user, session } = useAuth();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [config, setConfig] = useState<ConfigMensagem | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<string>("disconnected");
  const [ownerNumber, setOwnerNumber] = useState<string | null>(null);
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

    // Etapa 1: carrega tudo do Supabase em paralelo, com Promise.allSettled
    // para que uma consulta lenta/falha NÃO derrube as outras nem trave a aba.
    try {
      const [contatosRes, instanceRes, configRes, enviosRes] =
        await Promise.allSettled([
          withRequestTimeout(
            supabase.from("contatos").select("id, nome, telefone").order("nome"),
            "O carregamento dos contatos",
          ),
          withRequestTimeout(
            supabase
              .from("whatsapp_instances")
              .select("instance_name, status")
              .eq("user_id", user.id)
              .maybeSingle(),
            "O carregamento da instância",
          ),
          withRequestTimeout(
            supabase
              .from("config_mensagem")
              .select("mensagem, imagem_url")
              .eq("user_id", user.id)
              .maybeSingle(),
            "O carregamento da configuração",
          ),
          withRequestTimeout(
            supabase
              .from("envios")
              .select("id, telefone, nome, status, erro, data_envio")
              .eq("user_id", user.id)
              .order("data_envio", { ascending: false })
              .limit(10),
            "O carregamento do histórico",
          ),
        ]);

      const errors: unknown[] = [];

      if (contatosRes.status === "fulfilled" && !contatosRes.value.error) {
        setContatos((contatosRes.value.data as Contato[]) ?? []);
      } else {
        setContatos([]);
        errors.push(
          contatosRes.status === "rejected"
            ? contatosRes.reason
            : contatosRes.value.error,
        );
      }

      let resolvedInstanceName: string | null = null;
      let resolvedStatus = "disconnected";
      if (instanceRes.status === "fulfilled" && !instanceRes.value.error) {
        const i = instanceRes.value.data as
          | { instance_name: string; status: string }
          | null;
        if (i) {
          resolvedInstanceName = i.instance_name;
          resolvedStatus = i.status;
        }
      } else {
        errors.push(
          instanceRes.status === "rejected"
            ? instanceRes.reason
            : instanceRes.value.error,
        );
      }
      setInstanceName(resolvedInstanceName);
      setInstanceStatus(resolvedStatus);

      if (configRes.status === "fulfilled" && !configRes.value.error) {
        setConfig((configRes.value.data as ConfigMensagem) ?? null);
      } else {
        setConfig(null);
        errors.push(
          configRes.status === "rejected"
            ? configRes.reason
            : configRes.value.error,
        );
      }

      if (enviosRes.status === "fulfilled" && !enviosRes.value.error) {
        setEnvios((enviosRes.value.data as Envio[]) ?? []);
      } else {
        setEnvios([]);
        errors.push(
          enviosRes.status === "rejected"
            ? enviosRes.reason
            : enviosRes.value.error,
        );
      }

      // Só mostra alerta de carregamento se TUDO falhou; falhas parciais
      // ficam silenciosas (logadas) e a tela continua utilizável.
      if (errors.length === 4) {
        setLoadError(getAniversariosErrorMessage(errors[0]));
      } else if (errors.length > 0) {
        console.warn("[EnvioTab] erros parciais ao carregar", errors);
      }

      // Etapa 2: sincroniza status real da Evolution em background.
      // NÃO bloqueia render. Erro/timeout aqui não afeta a aba.
      if (resolvedInstanceName) {
        const instanceName = resolvedInstanceName;
        const userId = user.id;
        void (async () => {
          try {
            const statusResult = await withEvolutionTimeout(
              getInstanceStatus({ data: { instanceName } }),
              "A verificação de status do WhatsApp",
            );
            if (!statusResult.success) return;
            const body = statusResult.data as
              | { instance?: { state?: string }; state?: string }
              | undefined;
            const state = body?.instance?.state ?? body?.state;
            const realStatus = state === "open" ? "connected" : "disconnected";
            setInstanceStatus(realStatus);
            await supabase
              .from("whatsapp_instances")
              .update({ status: realStatus })
              .eq("user_id", userId);
          } catch (err) {
            console.warn("[EnvioTab] sync status falhou", err);
          }
        })();
      }
    } catch (error) {
      // Capturado apenas em casos extremos (Promise.allSettled não rejeita).
      setLoadError(getAniversariosErrorMessage(error));
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
    const rawPhone = contato?.telefone || customPhone;
    const nome = contato?.nome || customNome || "paciente";

    if (!rawPhone) {
      toast.error("Selecione um contato ou digite um número");
      return;
    }

    const normalized = normalizePhoneBR(rawPhone);
    if (!normalized.valid) {
      toast.error(
        normalized.reason ??
          "Número inválido. Use formato 55DDXXXXXXXXX (ex: 5521981089100).",
      );
      return;
    }
    const phone = normalized.phone;

    setSending(true);
    const finalMessage = buildMensagemPreview(mensagemTemplate, nome);
    const hasImage = Boolean(config?.imagem_url);
    const tipoEnvio = hasImage ? "imagem + legenda" : "texto";

    try {
      const result = hasImage
        ? await withEvolutionTimeout(
            sendMediaMessage({
              data: {
                instanceName,
                phone,
                caption: finalMessage,
                mediaUrl: config!.imagem_url!,
                mediaType: "image",
              },
            }),
            "O envio da mensagem com imagem",
          )
        : await withEvolutionTimeout(
            sendTextMessage({
              data: { instanceName, phone, message: finalMessage },
            }),
            "O envio da mensagem",
          );

      const status = result.success ? "pendente" : "erro";
      const erro = result.success
        ? `Envio (${tipoEnvio}) aceito pela Evolution${
            result.providerStatus ? ` com status ${result.providerStatus}` : ""
          }. A entrega final no WhatsApp ainda não foi confirmada.`
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
        toast.success(
          `Mensagem (${tipoEnvio}) aceita pela Evolution para ${nome}.`,
        );
        toast.info(
          "Status 'pendente' = aceita pela API, aguardando entrega final no WhatsApp.",
        );
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
          <CardDescription>
            <strong>Pendente</strong> = aceito pela Evolution API, aguardando
            entrega final no WhatsApp do destinatário.{" "}
            <strong>Erro</strong> = a Evolution rejeitou o envio (passe o mouse
            no ⓘ para ver o motivo).
          </CardDescription>
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
