import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  createInstance,
  getQrCode,
  getInstanceStatus,
  configureInstanceWebhook,
} from "@/utils/evolution.functions";
import {
  Smartphone,
  QrCode,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  Loader2,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getAniversariosErrorMessage,
  withRequestTimeout,
} from "@/components/aniversarios/request-utils";

interface Instance {
  id: string;
  instance_name: string;
  instance_id: string | null;
  status: string;
}

type StepKey = "create" | "save" | "qr" | "scan" | "connected";
type StepState = "pending" | "active" | "done" | "error";

const STEP_LABELS: Record<StepKey, string> = {
  create: "Criando instância na Evolution API",
  save: "Registrando instância no banco de dados",
  qr: "Gerando QR Code",
  scan: "Aguardando leitura do QR Code no celular",
  connected: "WhatsApp conectado",
};

const STEP_ORDER: StepKey[] = ["create", "save", "qr", "scan", "connected"];

const INITIAL_STEPS: Record<StepKey, StepState> = {
  create: "pending",
  save: "pending",
  qr: "pending",
  scan: "pending",
  connected: "pending",
};

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_DURATION_MS = 2 * 60 * 1000; // 2 minutos
const POLL_MAX_CONSECUTIVE_ERRORS = 3;

// Gera um nome de instância exclusivo e estável por usuário.
// Formato: dentalhub-{userIdSemHifens(primeiros 16 chars)}
// Compatível com o regex aceito por createInstance: ^[a-zA-Z0-9_-]+$
function buildInstanceName(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16);
  return `dentalhub-${safe}`;
}

export function WhatsAppTab({ acessoAtivo = true }: { acessoAtivo?: boolean } = {}) {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [steps, setSteps] =
    useState<Record<StepKey, StepState>>(INITIAL_STEPS);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartedAtRef = useRef<number>(0);
  const pollErrorsRef = useRef<number>(0);
  // Garante que bootstrapConnection só roda 1× por instância carregada do
  // cache. Voltar à aba dentro do staleTime NÃO refaz QR / polling.
  const bootstrappedForRef = useRef<string | null>(null);

  // Carrega a instância via useQuery (cache de 30s entre navegações).
  const instanceQuery = useQuery({
    queryKey: ["aniv:wpp:instance", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase
          .from("whatsapp_instances")
          .select("*")
          .eq("user_id", userId!)
          .maybeSingle(),
        "O carregamento da instância do WhatsApp",
      );
      if (error) throw error;
      return ((data as Instance) ?? null);
    },
  });

  const getAccessToken = useCallback(async () => {
    const {
      data: { session: liveSession },
    } = await supabase.auth.getSession();
    const accessToken = liveSession?.access_token ?? session?.access_token;

    if (!accessToken) {
      throw new Error("Sem sessão");
    }

    return accessToken;
  }, [session?.access_token]);

  const updateStep = (key: StepKey, state: StepState) =>
    setSteps((prev) => ({ ...prev, [key]: state }));

  const resetSteps = () => setSteps({ ...INITIAL_STEPS });

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollStartedAtRef.current = 0;
    pollErrorsRef.current = 0;
  }, []);

  const markConnected = useCallback(
    async (instanceRow: Instance | null) => {
      stopPolling();
      setQrCode(null);
      setQrError(null);
      setSteps({
        create: "done",
        save: "done",
        qr: "done",
        scan: "done",
        connected: "done",
      });
      if (instanceRow) {
        try {
          await supabase
            .from("whatsapp_instances")
            .update({ status: "connected" })
            .eq("id", instanceRow.id);
          setInstance({ ...instanceRow, status: "connected" });
          // Mantém o cache do React Query alinhado com o status real.
          void queryClient.invalidateQueries({
            queryKey: ["aniv:wpp:instance", userId],
          });
          void queryClient.invalidateQueries({
            queryKey: ["aniv:instance", userId],
          });
        } catch {
          // não bloqueia UI por falha de update
        }
      }
    },
    [stopPolling, queryClient, userId],
  );

  // Quando a instância foi apagada diretamente na Evolution API (404),
  // removemos o registro do Supabase para que o usuário possa criar uma
  // nova instância. createInstance vai gerar um novo instance_name único
  // baseado no nome da clínica/responsável.
  const handleInstanceDeletedRemotely = useCallback(
    async (instanceRow: Instance) => {
      stopPolling();
      setQrCode(null);
      resetSteps();
      try {
        await supabase
          .from("whatsapp_instances")
          .delete()
          .eq("id", instanceRow.id)
          .eq("user_id", userId!);
      } catch (err) {
        console.warn("[WhatsAppTab] falha ao limpar instância órfã", err);
      }
      setInstance(null);
      bootstrappedForRef.current = null;
      void queryClient.invalidateQueries({
        queryKey: ["aniv:wpp:instance", userId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["aniv:instance", userId],
      });
      setQrError(
        "A instância anterior foi removida na Evolution API. Clique em \"Conectar WhatsApp\" para criar uma nova.",
      );
      toast.info("Instância removida na Evolution. Crie uma nova abaixo.");
    },
    [stopPolling, queryClient, userId],
  );

  const fetchQrAndShow = useCallback(
    async (instanceName: string, accessToken: string) => {
      updateStep("qr", "active");
      const qrResult = await getQrCode({
        data: { instanceName, accessToken },
      });
      if (!qrResult.success) {
        updateStep("qr", "error");
        setQrCode(null);
        setQrError(qrResult.error ?? "Erro ao obter QR Code");
        return false;
      }
      if (qrResult.data?.instance?.state === "open") {
        return "connected" as const;
      }
      if (qrResult.data?.base64) {
        setQrCode(qrResult.data.base64);
        setQrError(null);
        updateStep("qr", "done");
        updateStep("scan", "active");
        return true;
      }
      updateStep("qr", "error");
      setQrCode(null);
      setQrError(
        "QR Code não disponível no momento. Clique em 'Tentar novamente'.",
      );
      return false;
    },
    [],
  );

  const startPolling = useCallback(
    (instanceRow: Instance, accessToken: string) => {
      stopPolling();
      pollStartedAtRef.current = Date.now();
      pollErrorsRef.current = 0;

      pollIntervalRef.current = setInterval(async () => {
        // Timeout de segurança
        if (Date.now() - pollStartedAtRef.current > POLL_MAX_DURATION_MS) {
          stopPolling();
          setQrError(
            "Tempo esgotado aguardando leitura do QR. Clique em 'Atualizar Status' ou 'Tentar novamente'.",
          );
          return;
        }

        try {
          const result = await withRequestTimeout(
            getInstanceStatus({
              data: {
                instanceName: instanceRow.instance_name,
                accessToken,
              },
            }),
            "A verificação automática de status",
          );

          if (!result.success) {
            pollErrorsRef.current += 1;
            if (pollErrorsRef.current >= POLL_MAX_CONSECUTIVE_ERRORS) {
              stopPolling();
              setQrError(
                result.error ??
                  "Não foi possível verificar o status do WhatsApp.",
              );
            }
            return;
          }

          pollErrorsRef.current = 0;
          const state = result.data?.instance?.state ?? "disconnected";
          if (state === "open") {
            toast.success("WhatsApp conectado!");
            await markConnected(instanceRow);
          }
        } catch (error) {
          pollErrorsRef.current += 1;
          if (pollErrorsRef.current >= POLL_MAX_CONSECUTIVE_ERRORS) {
            stopPolling();
            setQrError(getAniversariosErrorMessage(error));
          }
        }
      }, POLL_INTERVAL_MS);
    },
    [markConnected, stopPolling],
  );

  // Bootstrap usa a instância cacheada pelo useQuery — sem refetch SQL
  // toda vez que a aba remonta. Só dispara verificação de status/QR uma vez
  // por instância (`bootstrappedForRef`).
  const bootstrapConnection = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Aguarda o useQuery terminar a primeira carga
    if (instanceQuery.isLoading) return;

    setQrError(null);

    try {
      const existingInstance = instanceQuery.data ?? null;
      setInstance(existingInstance);

      if (!existingInstance) {
        resetSteps();
        return;
      }

      // Já rodou bootstrap para esta instância nesta sessão? Não refaz QR.
      const key = `${existingInstance.id}:${existingInstance.status}`;
      if (bootstrappedForRef.current === key) return;
      bootstrappedForRef.current = key;

      resetSteps();
      updateStep("create", "done");
      updateStep("save", "done");

      const accessToken = await getAccessToken();
      const statusResult = await withRequestTimeout(
        getInstanceStatus({
          data: {
            instanceName: existingInstance.instance_name,
            accessToken,
          },
        }),
        "A verificação de status do WhatsApp",
      );

      if (!statusResult.success) {
        setQrError(
          statusResult.error ?? "Não foi possível verificar o status.",
        );
        return;
      }

      // Instância foi deletada do lado da Evolution → limpa do banco
      // para permitir recriação (que vai reaproveitar o mesmo instance_name).
      if ((statusResult as { notFound?: boolean }).notFound) {
        await handleInstanceDeletedRemotely(existingInstance);
        return;
      }

      const state = statusResult.data?.instance?.state ?? "disconnected";

      if (state === "open") {
        await markConnected(existingInstance);
        return;
      }

      const qrOutcome = await fetchQrAndShow(
        existingInstance.instance_name,
        accessToken,
      );
      if (qrOutcome === "connected") {
        await markConnected(existingInstance);
      } else if (qrOutcome === true) {
        startPolling(existingInstance, accessToken);
      }
    } catch (error) {
      setQrError(getAniversariosErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [
    user,
    instanceQuery.isLoading,
    instanceQuery.data,
    getAccessToken,
    fetchQrAndShow,
    markConnected,
    startPolling,
    handleInstanceDeletedRemotely,
  ]);

  useEffect(() => {
    // Quando o useQuery termina, rebaixa o `loading` local (mesmo sem instância).
    if (!instanceQuery.isLoading) setLoading(false);
  }, [instanceQuery.isLoading]);

  useEffect(() => {
    bootstrapConnection();
    return () => {
      stopPolling();
    };
  }, [bootstrapConnection, stopPolling]);

  // handleConnect agora cuida APENAS de criar instância nova
  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    setQrError(null);
    resetSteps();

    try {
      const accessToken = await getAccessToken();
      updateStep("create", "active");
      const instanceName = buildInstanceName(user.id);
      const result = await createInstance({
        data: {
          instanceName,
          accessToken,
        },
      });

      if (!result.success) {
        const isDbError =
          result.error?.includes("salvar no banco") ||
          result.error?.includes("consultar banco");
        if (isDbError) {
          updateStep("create", "done");
          updateStep("save", "error");
        } else {
          updateStep("create", "error");
        }
        toast.error(result.error ?? "Erro ao criar instância");
        setQrError(result.error ?? "Erro ao criar instância");
        return;
      }

      updateStep("create", "done");
      updateStep("save", "done");

      // Limpa o ref para permitir novo bootstrap com a instância recém-criada
      bootstrappedForRef.current = null;
      // Invalida cache para forçar refetch da nova instância no useQuery
      await queryClient.invalidateQueries({
        queryKey: ["aniv:wpp:instance", userId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["aniv:instance", userId],
      });
    } catch (error) {
      setQrError(getAniversariosErrorMessage(error));
      toast.error(getAniversariosErrorMessage(error));
    } finally {
      setConnecting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!instance) return;
    setChecking(true);
    try {
      const accessToken = await getAccessToken();
      const result = await withRequestTimeout(
        getInstanceStatus({
          data: { instanceName: instance.instance_name, accessToken },
        }),
        "A verificação de status do WhatsApp",
      );
      if (!result.success) {
        toast.error(result.error ?? "Erro ao verificar status");
        return;
      }

      // Instância foi deletada do lado da Evolution → limpa do banco.
      if ((result as { notFound?: boolean }).notFound) {
        await handleInstanceDeletedRemotely(instance);
        return;
      }

      const state = result.data?.instance?.state ?? "disconnected";

      if (state === "open") {
        toast.success("WhatsApp conectado!");
        await markConnected(instance);
      } else {
        toast.info("WhatsApp ainda não conectado");
        await supabase
          .from("whatsapp_instances")
          .update({ status: "disconnected" })
          .eq("id", instance.id);
        setInstance({ ...instance, status: "disconnected" });
        void queryClient.invalidateQueries({
          queryKey: ["aniv:wpp:instance", userId],
        });
      }
    } catch (error) {
      toast.error(getAniversariosErrorMessage(error));
    } finally {
      setChecking(false);
    }
  };

  const handleConfigureWebhook = async () => {
    if (!instance) return;
    setConfiguringWebhook(true);
    try {
      const accessToken = await getAccessToken();
      const result = await withRequestTimeout(
        configureInstanceWebhook({
          data: { instanceName: instance.instance_name, accessToken },
        }),
        "A configuração do webhook",
      );
      if (!result.success) {
        toast.error(result.error ?? "Erro ao configurar webhook");
        return;
      }
      toast.success(
        `Webhook configurado! Eventos: ${result.events?.join(", ") ?? "—"}`,
      );
      console.log("[WhatsAppTab] webhook configurado", {
        endpoint: result.endpoint,
        webhookUrl: result.webhookUrl,
        events: result.events,
      });
    } catch (error) {
      toast.error(getAniversariosErrorMessage(error));
    } finally {
      setConfiguringWebhook(false);
    }
  };

  const StepperCard = () => {
    const anyActivity = Object.values(steps).some((s) => s !== "pending");
    if (!anyActivity && !connecting) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso da conexão</CardTitle>
          <CardDescription>
            Acompanhe cada etapa do fluxo abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {STEP_ORDER.map((key, idx) => {
            const state = steps[key];
            const Icon =
              state === "done"
                ? CheckCircle2
                : state === "active"
                  ? Loader2
                  : Circle;
            const colorClass =
              state === "done"
                ? "text-primary"
                : state === "active"
                  ? "text-primary"
                  : state === "error"
                    ? "text-destructive"
                    : "text-muted-foreground";
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <Icon
                  className={`h-4 w-4 ${colorClass} ${state === "active" ? "animate-spin" : ""}`}
                />
                <span className="text-muted-foreground">{idx + 1}.</span>
                <span
                  className={
                    state === "pending"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  }
                >
                  {STEP_LABELS[key]}
                </span>
                {state === "active" && (
                  <Badge variant="secondary" className="ml-auto">
                    Em andamento
                  </Badge>
                )}
                {state === "done" && (
                  <Badge variant="default" className="ml-auto">
                    Concluído
                  </Badge>
                )}
                {state === "error" && (
                  <Badge variant="destructive" className="ml-auto">
                    Falhou
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Sem instância → botão para criar
  if (!instance) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <CardTitle>Conectar WhatsApp</CardTitle>
            <CardDescription>
              Cada conta tem sua própria instância de WhatsApp. Clique abaixo
              para criar a sua e escanear o QR Code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleConnect}
              disabled={connecting || !acessoAtivo}
              title={!acessoAtivo ? "Assine um plano para liberar" : undefined}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              {connecting ? "Conectando..." : "Conectar WhatsApp"}
            </Button>
          </CardContent>
        </Card>
        <StepperCard />
        {qrError && (
          <Card className="border-destructive/40">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-destructive">{qrError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnect}
                disabled={connecting}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Tentar novamente
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StepperCard />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {instance.status === "connected" ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              <div>
                <CardTitle className="text-lg">Sua instância</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {instance.instance_name}
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={
                instance.status === "connected" ? "default" : "secondary"
              }
            >
              {instance.status === "connected" ? "Conectado" : "Desconectado"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {instance.status !== "connected" && (
            <Button
              size="sm"
              onClick={() => bootstrapConnection()}
              disabled={loading}
            >
              <QrCode className="mr-1 h-4 w-4" />
              Gerar / Atualizar QR Code
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCheckStatus}
            disabled={checking}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${checking ? "animate-spin" : ""}`}
            />
            Atualizar Status
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleConfigureWebhook}
            disabled={configuringWebhook}
            title="Registra o webhook de status na Evolution API para esta instância"
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${configuringWebhook ? "animate-spin" : ""}`}
            />
            {configuringWebhook ? "Configurando..." : "Configurar Webhook"}
          </Button>
        </CardContent>
      </Card>

      {instance.status === "connected" && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Wifi className="h-6 w-6 text-green-500" />
            <div>
              <p className="font-medium">WhatsApp conectado</p>
              <p className="text-sm text-muted-foreground">
                Você já pode enviar mensagens pela aba Envio.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {qrCode && instance.status !== "connected" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escaneie o QR Code</CardTitle>
            <CardDescription>
              Abra o WhatsApp no seu celular → Configurações → Dispositivos
              conectados → Conectar dispositivo. Estamos verificando a conexão
              automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-lg border bg-white p-4">
              <img
                src={
                  qrCode.startsWith("data:")
                    ? qrCode
                    : `data:image/png;base64,${qrCode}`
                }
                alt="QR Code WhatsApp"
                className="h-64 w-64"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleCheckStatus}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Já escaneei, verificar conexão
            </Button>
          </CardContent>
        </Card>
      )}

      {qrError && instance.status !== "connected" && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-destructive">{qrError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => bootstrapConnection()}
              disabled={loading}
            >
              <QrCode className="mr-1 h-4 w-4" />
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
