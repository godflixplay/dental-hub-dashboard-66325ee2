import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/recuperacao")({
  component: RecuperacaoPage,
});

function RecuperacaoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Recuperação</h1>
          <Badge variant="secondary">Em breve</Badge>
        </div>
      </div>

      <Card className="opacity-60">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <UserCheck className="h-5 w-5" />
          </div>
          <CardTitle>Recuperação de pacientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Este módulo estará disponível em breve. Recupere pacientes inativos com
              mensagens automáticas de reengajamento via WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
