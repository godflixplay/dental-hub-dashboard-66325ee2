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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [creating, setCreating] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [instanceName, setInstanceName] = useState("");
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

  const handleCreate = async () => {
    if (!user || !instanceName.trim()) return;
    setCreating(true);
    try {
      const result = await createInstance({
        data: { instanceName: instanceName.trim() },
      });
      if (!result.success) {
        toast.error(result.error ?? "Erro ao criar instância");
        return;
      }

      const { error } = await supabase.from("whatsapp_instances").insert({
        user_id: user.id,
        instance_name: instanceName.trim(),
        instance_id: result.data?.instance?.instanceId ?? null,
        status: "disconnected",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Instância criada!");
      // Show QR code from creation response
      if (result.data?.qrcode?.base64) {
        setQrCode(result.data.qrcode.base64);
      }
      fetchInstance();
    } catch {
      toast.error("Erro ao criar instância");
    } finally {
      setCreating(false);
    }
  };

  const handleGetQr = async () => {
    if (!instance) return;
    setQrLoading(true);
    try {
      const result = await getQrCode({
        data: { instanceName: instance.instance_name },
      });
      if (!result.success) {
        toast.error(result.error ?? "Erro ao obter QR Code");
        return;
      }
      if (result.data?.base64) {
        setQrCode(result.data.base64);
      } else if (result.data?.instance?.state === "open") {
        toast.success("WhatsApp já está conectado!");
        await supabase
          .from("whatsapp_instances")
          .update({ status: "connected" })
          .eq("id", instance.id);
        fetchInstance();
      } else {
        toast.info("QR Code não disponível. Tente novamente.");
      }
    } catch {
      toast.error("Erro ao obter QR Code");
    } finally {
      setQrLoading(false);
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

  if (!instance) {
    return (
      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-5 w-5" />
          </div>
          <CardTitle>Conectar WhatsApp</CardTitle>
          <CardDescription>
            Crie uma instância para conectar seu WhatsApp e começar a enviar
            mensagens automáticas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nome da Instância</Label>
            <Input
              placeholder="minha-clinica"
              value={instanceName}
              onChange={(e) =>
                setInstanceName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use apenas letras, números, hífen e underscore
            </p>
          </div>
          <Button onClick={handleCreate} disabled={creating || !instanceName}>
            {creating ? "Criando..." : "Criar Instância"}
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
                <CardTitle className="text-lg">
                  {instance.instance_name}
                </CardTitle>
                <CardDescription>Instância do WhatsApp</CardDescription>
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
        <CardContent className="flex gap-2">
          {instance.status !== "connected" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleGetQr}
              disabled={qrLoading}
            >
              <QrCode className="mr-1 h-4 w-4" />
              {qrLoading ? "Carregando..." : "Gerar QR Code"}
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
            Verificar Status
          </Button>
        </CardContent>
      </Card>

      {qrCode && (
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
