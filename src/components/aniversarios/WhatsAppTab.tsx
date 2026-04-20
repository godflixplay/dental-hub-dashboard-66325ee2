import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  createInstance,
  getQrCode,
  getInstanceStatus,
} from "@/utils/evolution.functions";
import { Smartphone, QrCode, RefreshCw, Wifi, WifiOff } from "lucide-react";
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

export function WhatsAppTab() {
  const { user } = useAuth();
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

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

  // Regra: 1 usuário = 1 instância, nome derivado do user_id
  const buildInstanceName = (userId: string) =>
    `user_${userId.replace(/-/g, "")}`;

  const handleConnect = async () => {
    if (!user) return;
    setConnecting(true);
    try {
      const instanceName = instance?.instance_name ?? buildInstanceName(user.id);

      // 1) Cria instância se ainda não existir
      if (!instance) {
        const result = await createInstance({ data: { instanceName } });
        if (!result.success) {
          toast.error(result.error ?? "Erro ao criar instância");
          return;
        }
        const { error } = await supabase.from("whatsapp_instances").insert({
          user_id: user.id,
          instance_name: instanceName,
          instance_id: result.data?.instance?.instanceId ?? null,
          status: "disconnected",
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        if (result.data?.qrcode?.base64) {
          setQrCode(result.data.qrcode.base64);
        }
        await fetchInstance();
      }

      // 2) Busca/atualiza o QR Code
      const qrResult = await getQrCode({ data: { instanceName } });
      if (!qrResult.success) {
        toast.error(qrResult.error ?? "Erro ao obter QR Code");
        return;
      }
      if (qrResult.data?.base64) {
        setQrCode(qrResult.data.base64);
        toast.success("QR Code gerado! Escaneie com seu WhatsApp.");
      } else if (qrResult.data?.instance?.state === "open") {
        toast.success("WhatsApp já está conectado!");
        await supabase
          .from("whatsapp_instances")
          .update({ status: "connected" })
          .eq("user_id", user.id);
        setQrCode(null);
        await fetchInstance();
      } else {
        toast.info("QR Code não disponível. Tente novamente em instantes.");
      }
    } catch {
      toast.error("Erro ao conectar WhatsApp");
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
    </div>
  );
}
