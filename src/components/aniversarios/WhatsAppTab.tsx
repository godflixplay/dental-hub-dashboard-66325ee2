import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  createInstance,
  getQrCode,
  getInstanceStatus,
} from "@/utils/evolution.functions";
import { Smartphone, QrCode, RefreshCw, Wifi, WifiOff, CheckCircle2, Loader2, Circle } from "lucide-react";
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

export function WhatsAppTab() {
  const { user, session } = useAuth();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    create: "pending",
    save: "pending",
    qr: "pending",
    scan: "pending",
    connected: "pending",
  });

  const updateStep = (key: StepKey, state: StepState) =>
    setSteps((prev) => ({ ...prev, [key]: state }));

  const resetSteps = () =>
    setSteps({
      create: "pending",
      save: "pending",
      qr: "pending",
      scan: "pending",
      connected: "pending",
    });

  const fetchInstance = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setInstance((data as Instance) ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  const buildInstanceName = () => "DentalHubTeste";

  const handleConnect = async () => {
    if (!user) return;
    if (!session?.access_token) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }

    setConnecting(true);
    setQrError(null);
    resetSteps();
    try {
      const instanceName = buildInstanceName();

      // 1) Garante que a instância desejada exista na Evolution e no banco
      if (!instance || instance.instance_name !== instanceName) {
        updateStep("create", "active");
        const result = await createInstance({ data: { instanceName } });
        if (!result.success) {
          updateStep("create", "error");
          toast.error(result.error ?? "Erro ao criar instância");
          setQrError(result.error ?? "Erro ao criar instância");
          return;
        }
        updateStep("create", "done");

        updateStep("save", "active");
        const payload = {
          user_id: user.id,
          instance_name: instanceName,
          instance_id: result.data?.instance?.instanceId ?? null,
          status: "disconnected",
        };

        const { error } = instance
          ? await supabase
              .from("whatsapp_instances")
              .update(payload)
              .eq("id", instance.id)
          : await supabase.from("whatsapp_instances").insert(payload);

        if (error) {
          updateStep("save", "error");
          toast.error(error.message);
          setQrError(error.message);
          return;
        }
        updateStep("save", "done");

        if (result.data?.qrcode?.base64) {
          setQrCode(result.data.qrcode.base64);
        }
        await fetchInstance();
      } else {
        updateStep("create", "done");
        updateStep("save", "done");
      }

      // 2) Busca/atualiza o QR Code
      updateStep("qr", "active");
      const qrResult = await getQrCode({
        data: { instanceName, accessToken: session.access_token },
      });
      if (!qrResult.success) {
        updateStep("qr", "error");
        setQrCode(null);
        setQrError(qrResult.error ?? "Erro ao obter QR Code");
        toast.error(qrResult.error ?? "Erro ao obter QR Code");
        return;
      }
      if (qrResult.data?.base64) {
        setQrCode(qrResult.data.base64);
        setQrError(null);
        updateStep("qr", "done");
        updateStep("scan", "active");
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (qrResult.data?.instance?.state === "open") {
        updateStep("qr", "done");
        updateStep("scan", "done");
        updateStep("connected", "done");
        toast.success("WhatsApp já está conectado!");
        await supabase
          .from("whatsapp_instances")
          .update({ status: "connected" })
          .eq("user_id", user.id);
        setQrCode(null);
        setQrError(null);
        await fetchInstance();
      } else {
        updateStep("qr", "error");
        setQrCode(null);
        setQrError(
          "QR Code não disponível no momento. Clique novamente para tentar gerar.",
        );
        toast.info("QR Code não disponível. Tente novamente em instantes.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro ao conectar WhatsApp";
      setQrCode(null);
      setQrError(message);
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!instance) return;
    setChecking(true);
    try {
      const result = await getInstanceStatus({
        data: { instanceName: instance.instance_name },
      });
      if (!result.success) {
        toast.error(result.error ?? "Erro ao verificar status");
        return;
      }

      const state = result.data?.instance?.state ?? "disconnected";
      const newStatus = state === "open" ? "connected" : "disconnected";

      await supabase
        .from("whatsapp_instances")
        .update({ status: newStatus })
        .eq("id", instance.id);

      if (newStatus === "connected") {
        toast.success("WhatsApp conectado!");
        setQrCode(null);
        setQrError(null);
        updateStep("scan", "done");
        updateStep("connected", "done");
      } else {
        toast.info("WhatsApp ainda não conectado");
      }
      fetchInstance();
    } catch {
      toast.error("Erro ao verificar status");
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Estado: ainda não criou instância
  if (!instance) {
    return (
      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <CardTitle>Conectar WhatsApp</CardTitle>
          <CardDescription>
            Cada conta tem sua própria instância de WhatsApp. Clique abaixo para
            criar a sua e escanear o QR Code.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={connecting}>
            <Smartphone className="mr-2 h-4 w-4" />
            {connecting ? "Conectando..." : "Conectar WhatsApp"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {instance.status === "connected" ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-destructive" />
              )}
              <div>
                <CardTitle className="text-lg">Sua instância</CardTitle>
                <CardDescription className="font-mono text-xs">
                  {buildInstanceName()}
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
              onClick={handleConnect}
              disabled={connecting}
            >
              <QrCode className="mr-1 h-4 w-4" />
              {connecting ? "Gerando QR..." : "Conectar / Gerar QR Code"}
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
              conectados → Conectar dispositivo
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
            <Button size="sm" variant="outline" onClick={handleConnect} disabled={connecting}>
              <QrCode className="mr-1 h-4 w-4" />
              {connecting ? "Tentando..." : "Tentar novamente"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
