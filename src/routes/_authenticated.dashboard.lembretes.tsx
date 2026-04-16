import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/dashboard/lembretes")({
  component: LembretesPage,
});

function LembretesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Lembretes</h1>
          <Badge variant="secondary">Em breve</Badge>
        </div>
      </div>

      <Card className="opacity-60">
        <CardHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Bell className="h-5 w-5" />
          </div>
          <CardTitle>Lembretes automáticos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              Este módulo estará disponível em breve. Envie lembretes automáticos de
              consultas e retornos para seus pacientes via WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
