import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getInstanceStatus } from "@/utils/evolution.functions";
import { triggerN8nTestWebhook } from "@/utils/n8n-webhook.functions";
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
  /** Mapeado de envios_whatsapp.created_at — mantido como data_envio para a UI. */
  data_envio: string;
}

interface ConfigMensagem {
  mensagem: string;
  imagem_url: string | null;
}

interface InstanceRow {
  instance_name: string;
  status: string;
}

// Throttle do sync de status Evolution: roda no máximo 1×/min por usuário.
const EVOLUTION_SYNC_THROTTLE_MS = 60_000;
const lastEvolutionSyncByUser = new Map<string, number>();

export function EnvioTab() {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [instanceStatus, setInstanceStatus] = useState<string>("disconnected");
  const [ownerNumber, setOwnerNumber] = useState<string | null>(null);
  const [selectedContato, setSelectedContato] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [customNome, setCustomNome] = useState("");
  const [sending, setSending] = useState(false);

  const getAccessToken = useCallback(async () => {
    const {
      data: { session: liveSession },
    } = await supabase.auth.getSession();
    const accessToken = liveSession?.access_token ?? session?.access_token;
    if (!accessToken) throw new Error("Sem sessão");
    return accessToken;
  }, [session?.access_token]);

  // Queries: cada uma com sua chave, cache compartilhado de 30s vindo do
  // QueryClient global. Trocar de aba/voltar para a página é instantâneo.
  const contatosQuery = useQuery({
    queryKey: ["aniv:contatos", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase.from("contatos").select("id, nome, telefone").order("nome"),
        "O carregamento dos contatos",
      );
      if (error) throw error;
      return (data as Contato[]) ?? [];
    },
  });

  const instanceQuery = useQuery({
    queryKey: ["aniv:instance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase
          .from("whatsapp_instances")
          .select("instance_name, status")
          .eq("user_id", userId!)
          .maybeSingle(),
        "O carregamento da instância",
      );
      if (error) throw error;
      return (data as InstanceRow | null) ?? null;
    },
  });

  const configQuery = useQuery({
    queryKey: ["aniv:config", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase
          .from("config_mensagem")
          .select("mensagem, imagem_url")
          .eq("user_id", userId!)
          .maybeSingle(),
        "O carregamento da configuração",
      );
      if (error) throw error;
      return (data as ConfigMensagem | null) ?? null;
    },
  });

  const enviosQuery = useQuery({
    queryKey: ["aniv:envios", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase
          .from("envios_whatsapp")
          .select("id, telefone, nome, status, erro, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(50),
        "O carregamento do histórico",
      );
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string;
        telefone: string;
        nome: string | null;
        status: string;
        erro: string | null;
        created_at: string;
      }>;
      return rows.map<Envio>((r) => ({
        id: r.id,
        telefone: r.telefone,
        nome: r.nome,
        status: r.status,
        erro: r.erro,
        data_envio: r.created_at,
      }));
    },
  });

  const contatos = contatosQuery.data ?? [];
  const instanceRow = instanceQuery.data ?? null;
  const config = configQuery.data ?? null;
  const envios = enviosQuery.data ?? [];
  const instanceName = instanceRow?.instance_name ?? null;

  // Sincroniza com status do banco quando a instância muda.
  useEffect(() => {
    if (instanceRow?.status) setInstanceStatus(instanceRow.status);
  }, [instanceRow?.status]);

  // Sync de status Evolution em background, com throttle de 60s por usuário.
  // Não bloqueia a renderização. Ao voltar para a aba dentro da janela de
  // throttle, NÃO dispara nova chamada — é o que evita o "trava por minutos".
  const syncEvolutionStatus = useCallback(async () => {
    if (!userId || !instanceName) return;
    const last = lastEvolutionSyncByUser.get(userId) ?? 0;
    if (Date.now() - last < EVOLUTION_SYNC_THROTTLE_MS) return;
    lastEvolutionSyncByUser.set(userId, Date.now());
    try {
      const accessToken = await getAccessToken();
      const statusResult = await withEvolutionTimeout(
        getInstanceStatus({ data: { instanceName, accessToken } }),
        "A verificação de status do WhatsApp",
      );
      if (!statusResult.success) return;
      const body = statusResult.data as
        | { instance?: { state?: string }; state?: string }
        | undefined;
      const state = body?.instance?.state ?? body?.state;
      const realStatus = state === "open" ? "connected" : "disconnected";
      setInstanceStatus(realStatus);
      if (statusResult.ownerNumber) setOwnerNumber(statusResult.ownerNumber);
      await supabase
        .from("whatsapp_instances")
        .update({ status: realStatus })
        .eq("user_id", userId);
    } catch (err) {
      console.warn("[EnvioTab] sync status falhou", err);
    }
  }, [userId, instanceName, getAccessToken]);

  const syncedRef = useRef(false);
  useEffect(() => {
    if (!instanceName || syncedRef.current) return;
    syncedRef.current = true;
    void syncEvolutionStatus();
  }, [instanceName, syncEvolutionStatus]);

  const refetchAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["aniv:contatos", userId] }),
      queryClient.invalidateQueries({ queryKey: ["aniv:instance", userId] }),
      queryClient.invalidateQueries({ queryKey: ["aniv:config", userId] }),
      queryClient.invalidateQueries({ queryKey: ["aniv:envios", userId] }),
    ]);
  }, [queryClient, userId]);

  // Realtime: novos envios aparecem no topo, updates de status atualizam a
  // linha existente, sem duplicar registros. Filtra por user_id para
  // garantir isolamento multi-tenant.
  useEffect(() => {
    if (!userId) return;
    const queryKey = ["aniv:envios", userId];

    const mapRow = (row: Record<string, unknown>): Envio => ({
      id: String(row.id),
      telefone: String(row.telefone ?? ""),
      nome: (row.nome as string | null) ?? null,
      status: String(row.status ?? ""),
      erro: (row.erro as string | null) ?? null,
      data_envio: String(row.created_at ?? new Date().toISOString()),
    });

    const channel = supabase
      .channel(`envios_whatsapp:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "envios_whatsapp",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const novo = mapRow(payload.new as Record<string, unknown>);
          queryClient.setQueryData<Envio[]>(queryKey, (prev = []) => {
            if (prev.some((e) => e.id === novo.id)) return prev;
            return [novo, ...prev].slice(0, 50);
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "envios_whatsapp",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const atualizado = mapRow(payload.new as Record<string, unknown>);
          queryClient.setQueryData<Envio[]>(queryKey, (prev = []) =>
            prev.map((e) => (e.id === atualizado.id ? atualizado : e)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);


  const loading =
    contatosQuery.isLoading ||
    instanceQuery.isLoading ||
    configQuery.isLoading ||
    enviosQuery.isLoading;

  const allFailed =
    contatosQuery.isError &&
    instanceQuery.isError &&
    configQuery.isError &&
    enviosQuery.isError;

  const loadError = allFailed
    ? getAniversariosErrorMessage(contatosQuery.error)
    : null;

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
      const accessToken = await getAccessToken();

      const stateCheck = await withEvolutionTimeout(
        getInstanceStatus({ data: { instanceName, accessToken } }),
        "A verificação de status do WhatsApp",
      );

      if (!stateCheck.success) {
        toast.error(
          `Não foi possível verificar o status da instância: ${stateCheck.error ?? "erro desconhecido"}`,
        );
        return;
      }

      const stateBody = stateCheck.data as
        | { instance?: { state?: string }; state?: string }
        | undefined;
      const realState = stateBody?.instance?.state ?? stateBody?.state;
      const liveOwner = stateCheck.ownerNumber ?? ownerNumber;
      if (liveOwner) setOwnerNumber(liveOwner);

      if (realState !== "open") {
        setInstanceStatus("disconnected");
        await supabase
          .from("whatsapp_instances")
          .update({ status: "disconnected" })
          .eq("user_id", user.id);
        toast.error(
          "WhatsApp não está conectado. Vá na aba WhatsApp e escaneie o QR Code novamente.",
        );
        void reconnectInstance({
          data: { instanceName, accessToken },
        }).catch(() => undefined);
        return;
      }

      setInstanceStatus("connected");

      if (liveOwner && liveOwner === phone) {
        toast.error(
          `Bloqueado: você está tentando enviar para o próprio número da instância (${liveOwner}). Use outro destinatário.`,
        );
        return;
      }

      const result = hasImage
        ? await withEvolutionTimeout(
            sendMediaMessage({
              data: {
                instanceName,
                accessToken,
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
              data: { instanceName, accessToken, phone, message: finalMessage },
            }),
            "O envio da mensagem",
          );

      const fullResponseLog = JSON.stringify(
        {
          number: phone,
          instance_name: instanceName,
          tipo: tipoEnvio,
          providerStatus: result.success ? result.providerStatus : undefined,
          messageId: result.success ? result.messageId : undefined,
          remoteJid: result.success ? result.remoteJid : undefined,
          response: result.success ? result.data : undefined,
          error: result.success ? undefined : result.error,
        },
        null,
        0,
      ).slice(0, 4000);

      console.log("[EnvioTab] envio completo:", fullResponseLog);

      let status: "pendente" | "erro";
      let erro: string;
      if (!result.success) {
        status = "erro";
        erro = `${result.error ?? "Erro desconhecido"} | log: ${fullResponseLog}`;
      } else if (!result.messageId) {
        status = "erro";
        erro = `Evolution retornou sucesso mas sem messageId/key.id (falha silenciosa). Mensagem provavelmente NÃO foi entregue. log: ${fullResponseLog}`;
      } else {
        status = "pendente";
        erro = `Aceito pela Evolution (${tipoEnvio}). messageId=${result.messageId} remoteJid=${result.remoteJid ?? "?"} providerStatus=${result.providerStatus || "?"}. Aguardando confirmação final no WhatsApp. log: ${fullResponseLog}`;
      }

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

      if (status === "pendente") {
        toast.success(
          `Mensagem (${tipoEnvio}) aceita pela Evolution para ${nome}.`,
        );
        toast.info(
          "Status 'pendente' = aceita pela API, aguardando entrega final no WhatsApp.",
        );
      } else {
        toast.error(erro.split(" | log:")[0]);
      }
      await refetchAll();
    } catch (err) {
      const msg = getAniversariosErrorMessage(err);
      await withRequestTimeout(
        supabase.from("envios").insert({
          user_id: user.id,
          contato_id: contato?.id ?? null,
          telefone: phone,
          nome,
          status: "erro",
          erro: `${msg} | instance=${instanceName} number=${phone}`,
        }),
        "O registro do erro de envio",
      ).catch(() => undefined);
      toast.error(msg);
      await refetchAll();
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
            Envie uma mensagem de teste para verificar se tudo está funcionando.
            {ownerNumber && (
              <>
                {" "}Instância conectada no número{" "}
                <strong>{ownerNumber}</strong>. Envios para esse mesmo número
                são bloqueados automaticamente.
              </>
            )}
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
