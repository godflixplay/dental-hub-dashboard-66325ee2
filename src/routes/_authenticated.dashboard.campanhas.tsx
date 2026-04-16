import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/campanhas")({
  component: CampanhasPage,
});

function CampanhasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Campanhas</h1>
          <Badge variant="secondary">Em breve</Badge>
        </div>
      </div>

      <Card className="opacity-60">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Megaphone className="h-5 w-5" />
          </div>
          <CardTitle>Campanhas de WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Este módulo estará disponível em breve. Você poderá criar campanhas de marketing
              e enviar mensagens em massa para sua base de pacientes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
