import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getInstanceStatus } from "@/utils/evolution.functions";
import { triggerN8nTestWebhook } from "@/utils/n8n-webhook.functions";
import { normalizePhoneBR } from "@/components/aniversarios/phone-utils";
import { Send, MessageSquare, AlertCircle, History, Webhook } from "lucide-react";
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

  // Guarda o último status notificado por id de envio para evitar toasts
  // duplicados quando o Realtime emite múltiplos eventos para a mesma linha.
  const notifiedStatusRef = useRef<Map<string, string>>(new Map());

  const notifyFinalStatus = useCallback((envio: Envio) => {
    const status = (envio.status || "").toLowerCase();
    const isFinal =
      status === "enviado" ||
      status === "erro" ||
      status === "pendente";
    if (!isFinal) return;
    const previous = notifiedStatusRef.current.get(envio.id);
    if (previous === status) return;
    notifiedStatusRef.current.set(envio.id, status);

    const alvo = envio.nome?.trim() || envio.telefone || "contato";
    if (status === "enviado") {
      toast.success(`Mensagem enviada para ${alvo}.`);
    } else if (status === "erro") {
      toast.error(
        `Falha ao enviar para ${alvo}${envio.erro ? `: ${envio.erro}` : ""}.`,
      );
    } else if (status === "pendente") {
      toast(`Envio para ${alvo} está pendente.`);
    }
  }, []);

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
          console.log("[EnvioTab] Realtime chegou (INSERT):", payload);
          const novo = mapRow(payload.new as Record<string, unknown>);
          queryClient.setQueryData<Envio[]>(queryKey, (prev = []) => {
            if (prev.some((e) => e.id === novo.id)) return prev;
            return [novo, ...prev].slice(0, 50);
          });
          // Também invalida a query para garantir consistência caso outro
          // componente esteja lendo a mesma chave.
          void queryClient.invalidateQueries({ queryKey });
          notifyFinalStatus(novo);
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
          console.log("[EnvioTab] Realtime chegou (UPDATE):", payload);
          const atualizado = mapRow(payload.new as Record<string, unknown>);
          queryClient.setQueryData<Envio[]>(queryKey, (prev = []) =>
            prev.map((e) => (e.id === atualizado.id ? atualizado : e)),
          );
          void queryClient.invalidateQueries({ queryKey });
          notifyFinalStatus(atualizado);
        },
      )
      .subscribe((status, err) => {
        console.log(`[EnvioTab] Realtime channel status: ${status}`, err ?? "");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient, notifyFinalStatus]);

  // Marca os envios já carregados na primeira renderização como "já notificados"
  // para não disparar um toast retroativo para cada linha do histórico.
  const seededNotifiedRef = useRef(false);
  useEffect(() => {
    if (seededNotifiedRef.current) return;
    if (enviosQuery.isLoading) return;
    const initial = enviosQuery.data ?? [];
    initial.forEach((e) => {
      notifiedStatusRef.current.set(e.id, (e.status || "").toLowerCase());
    });
    seededNotifiedRef.current = true;
  }, [enviosQuery.isLoading, enviosQuery.data]);


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

    try {
      const accessToken = await getAccessToken();

      // Aciona o webhook do n8n. O n8n é responsável por:
      // 1) chamar a Evolution API para enviar a mensagem
      // 2) inserir o registro em `envios_whatsapp` (com user_id correto)
      // O frontend NÃO insere nada no banco — a linha aparecerá automaticamente
      // na tabela "Últimos Envios" via Supabase Realtime.
      const result = await withRequestTimeout(
        triggerN8nTestWebhook({
          data: {
            accessToken,
            nome,
            telefone: phone,
            mensagem: finalMessage,
          },
        }),
        "O acionamento do webhook de teste",
        20000,
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      toast.success(`Disparo enviado ao n8n para ${nome}.`);

      // Marca a query como stale para disparar refetch automático em paralelo
      // ao loop manual de retry abaixo (Realtime + invalidate + retry concorrem).
      await queryClient.invalidateQueries({
        queryKey: ["aniv:envios", user.id],
      });

      // Recarrega imediatamente a lista a partir do Supabase
      // (não dependemos só do Realtime nem do carregamento inicial).
      // Tenta algumas vezes porque o n8n pode levar alguns segundos
      // para inserir/atualizar a linha em envios_whatsapp.
      const reloadEnvios = async () => {
        const { data, error } = await supabase
          .from("envios_whatsapp")
          .select("id, telefone, nome, status, erro, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (error) throw error;
        const rows = (data ?? []) as Array<{
          id: string;
          telefone: string;
          nome: string | null;
          status: string;
          erro: string | null;
          created_at: string;
        }>;
        const mapped = rows.map<Envio>((r) => ({
          id: r.id,
          telefone: r.telefone,
          nome: r.nome,
          status: r.status,
          erro: r.erro,
          data_envio: r.created_at,
        }));
        queryClient.setQueryData<Envio[]>(["aniv:envios", user.id], mapped);
        return mapped;
      };

      try {
        const previousIds = new Set((envios ?? []).map((e) => e.id));
        for (let attempt = 0; attempt < 6; attempt++) {
          const fresh = await reloadEnvios();
          const hasNew = fresh.some((e) => !previousIds.has(e.id));
          if (hasNew) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (reloadErr) {
        console.warn("[EnvioTab] reload envios falhou", reloadErr);
      }
    } catch (err) {
      toast.error(getAniversariosErrorMessage(err));
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
