import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { sendTextMessage } from "@/utils/evolution.functions";
import { Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";

interface Contato {
  id: string;
  nome: string;
  telefone: string;
}

export function EnvioTab() {
  const { user } = useAuth();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [instanceStatus, setInstanceStatus] = useState<string>("disconnected");
  const [selectedContato, setSelectedContato] = useState("");
  const [customPhone, setCustomPhone] = useState("");
  const [message, setMessage] = useState(
    "🎂 Feliz aniversário, {nome}! A equipe da clínica deseja a você um dia incrível! 🎉",
  );
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("contatos").select("id, nome, telefone").order("nome"),
      supabase
        .from("whatsapp_instances")
        .select("instance_name, status")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([contatosRes, instanceRes]) => {
      setContatos((contatosRes.data as Contato[]) ?? []);
      if (instanceRes.data) {
        setInstanceName(
          (instanceRes.data as { instance_name: string }).instance_name,
        );
        setInstanceStatus(
          (instanceRes.data as { status: string }).status,
        );
      }
      setLoading(false);
    });
  }, [user]);

  const handleSend = async () => {
    if (!instanceName) {
      toast.error("Conecte o WhatsApp primeiro");
      return;
    }

    const contato = contatos.find((c) => c.id === selectedContato);
    const phone = contato?.telefone || customPhone.replace(/\D/g, "");
    const nome = contato?.nome || "paciente";

    if (!phone) {
      toast.error("Selecione um contato ou digite um número");
      return;
    }

    if (!message.trim()) {
      toast.error("Digite uma mensagem");
      return;
    }

    setSending(true);
    try {
      const finalMessage = message.replace(/{nome}/g, nome);
      const result = await sendTextMessage({
        data: {
          instanceName,
          phone,
          message: finalMessage,
        },
      });

      if (result.success) {
        toast.success(`Mensagem enviada para ${phone}!`);
      } else {
        toast.error(result.error ?? "Erro ao enviar mensagem");
      }
    } catch {
      toast.error("Erro ao enviar mensagem");
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

  return (
    <div className="space-y-4">
      {/* Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Envio de Teste</CardTitle>
            <Badge
              variant={
                instanceStatus === "connected" ? "default" : "destructive"
              }
            >
              {instanceStatus === "connected"
                ? "WhatsApp Conectado"
                : "WhatsApp Desconectado"}
            </Badge>
          </div>
          <CardDescription>
            Envie uma mensagem de teste para verificar se tudo está funcionando
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Compor Mensagem
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
            <Label>Mensagem</Label>
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Use <code>{"{nome}"}</code> para inserir o nome do contato
            </p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || instanceStatus !== "connected"}
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Enviando..." : "Enviar Teste"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
