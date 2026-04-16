import { createFileRoute } from "@tanstack/react-router";
import {
  Users,
  Smartphone,
  Contact,
  MessageSquare,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  {
    title: "Total de Usuários",
    value: "—",
    description: "cadastrados na plataforma",
    icon: Users,
  },
  {
    title: "Usuários Ativos",
    value: "—",
    description: "com acesso ativo",
    icon: Users,
  },
  {
    title: "WhatsApp Conectado",
    value: "—",
    description: "instâncias ativas",
    icon: Smartphone,
  },
  {
    title: "Contatos Cadastrados",
    value: "—",
    description: "total na plataforma",
    icon: Contact,
  },
  {
    title: "Mensagens Enviadas",
    value: "—",
    description: "total de envios",
    icon: MessageSquare,
  },
  {
    title: "Receita Mensal (MRR)",
    value: "—",
    description: "valor recorrente",
    icon: DollarSign,
  },
];

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Dashboard Administrativo
        </h1>
        <p className="mt-1 text-muted-foreground">
          Visão geral da plataforma Dental Hub
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Crescimento de Usuários</CardTitle>
        </CardHeader>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
          Gráfico será exibido quando houver dados suficientes
        </CardContent>
      </Card>
    </div>
  );
}
