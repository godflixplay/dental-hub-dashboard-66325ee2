import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Cake, Smartphone, Upload, Send, Sparkles, CreditCard } from "lucide-react";

const STEPS = [
  {
    icon: CreditCard,
    title: "Escolha um plano e pague",
    desc: "PIX ou cartão. A partir de R$ 37/mês. Sem isso o sistema fica bloqueado.",
  },
  {
    icon: Smartphone,
    title: "Conecte seu WhatsApp",
    desc: "Aponte a câmera do celular para um QR Code, igual o WhatsApp Web. É seu próprio número que envia.",
  },
  {
    icon: Upload,
    title: "Suba a planilha de pacientes",
    desc: "Nome, telefone e data de nascimento. O sistema importa em segundos.",
  },
  {
    icon: Cake,
    title: "Escreva a mensagem de aniversário",
    desc: "Use {{nome}} para personalizar. Pode anexar imagem se quiser.",
  },
  {
    icon: Send,
    title: "Ative o envio automático",
    desc: "Pronto! Todos os aniversariantes recebem a mensagem sozinhos.",
  },
];

export function WelcomeTutorialModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tutorial_visto")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      // Se a coluna não existe (migration ainda não rodada) ou o valor é
      // false/null, mostra o modal.
      const visto = (data as { tutorial_visto?: boolean } | null)?.tutorial_visto;
      if (!visto) setOpen(true);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function marcarComoVisto() {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({ tutorial_visto: true })
        .eq("id", user.id);
    } catch {
      // se a coluna não existe ainda, ignora silenciosamente
    }
  }

  async function handleClose() {
    await marcarComoVisto();
    setOpen(false);
  }

  async function handleVerCompleto() {
    await marcarComoVisto();
    setOpen(false);
    navigate({ to: "/dashboard/tutorial" });
  }

  if (checking) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Bem-vindo ao Dental Hub!
          </DialogTitle>
          <DialogDescription>
            Em 5 passos rápidos você automatiza as mensagens de aniversário dos
            seus pacientes. <strong>Comece pelo plano</strong> — é o que
            destrava o sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {i + 1}. {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleClose}>
            Pular tutorial
          </Button>
          <Button onClick={handleVerCompleto}>Ver tutorial completo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
