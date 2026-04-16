import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Cake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard/aniversarios")({
  component: AniversariosPage,
});

function AniversariosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aniversários</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens automáticas de aniversário via WhatsApp
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cake className="h-5 w-5" />
          </div>
          <CardTitle>Configurar mensagens de aniversário</CardTitle>
          <CardDescription>
            Aqui você poderá cadastrar pacientes, definir mensagens personalizadas e
            configurar o envio automático via WhatsApp no dia do aniversário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Módulo em desenvolvimento. Em breve você poderá configurar tudo por aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
