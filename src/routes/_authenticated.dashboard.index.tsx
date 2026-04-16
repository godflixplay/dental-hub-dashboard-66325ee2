import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Cake, Megaphone, Bell, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardIndex,
});

const services = [
  {
    title: "Aniversários",
    description: "Envie mensagens automáticas de aniversário para seus pacientes via WhatsApp.",
    icon: Cake,
    slug: "/dashboard/aniversarios",
    status: "ativo" as const,
  },
  {
    title: "Campanhas",
    description: "Crie e envie campanhas de marketing por WhatsApp para sua base de pacientes.",
    icon: Megaphone,
    slug: "/dashboard/campanhas",
    status: "em_breve" as const,
  },
  {
    title: "Lembretes",
    description: "Lembretes automáticos de consultas e retornos para seus pacientes.",
    icon: Bell,
    slug: "/dashboard/lembretes",
    status: "em_breve" as const,
  },
  {
    title: "Recuperação",
    description: "Recupere pacientes inativos com mensagens automáticas de reengajamento.",
    icon: UserCheck,
    slug: "/dashboard/recuperacao",
    status: "em_breve" as const,
  },
];

function DashboardIndex() {
  const { user, role } = useAuth();

  if (role === "admin") {
    return <Navigate to="/dashboard/admin" />;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Olá, {user?.email?.split("@")[0]} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Gerencie suas automações de WhatsApp
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {services.map((service) => {
          const isActive = service.status === "ativo";
          return (
            <Card
              key={service.slug}
              className={`relative transition-shadow ${isActive ? "hover:shadow-lg" : "opacity-60"}`}
            >
              {!isActive && (
                <div className="absolute right-4 top-4">
                  <Badge variant="secondary">Em breve</Badge>
                </div>
              )}
              <CardHeader>
                <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-lg ${isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  <service.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{service.title}</CardTitle>
                <CardDescription>{service.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {isActive ? (
                  <Button asChild>
                    <Link to={service.slug}>Acessar</Link>
                  </Button>
                ) : (
                  <Button disabled variant="secondary">
                    Em breve
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
