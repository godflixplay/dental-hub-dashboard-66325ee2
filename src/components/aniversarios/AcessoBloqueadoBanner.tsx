import { Link } from "@tanstack/react-router";
import { Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { AcessoAtivoState } from "@/hooks/use-acesso-ativo";

interface AcessoBloqueadoBannerProps {
  acesso: AcessoAtivoState;
  /** Texto curto explicando o que está bloqueado nesta tela. */
  acao?: string;
}

/**
 * Banner mostrado em cada aba de Aniversários quando o usuário ainda
 * não tem acesso confirmado. Permite navegar e ver as telas, mas as
 * ações ficam desabilitadas (com aviso).
 */
export function AcessoBloqueadoBanner({
  acesso,
  acao,
}: AcessoBloqueadoBannerProps) {
  if (acesso.loading || acesso.ativo) return null;

  return (
    <Card className="border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-foreground">
              {acao
                ? `${acao} está bloqueado`
                : "Recurso bloqueado"}
            </p>
            <p className="mt-1 text-muted-foreground">{acesso.mensagem}</p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/dashboard/assinatura">
            Ver planos
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
