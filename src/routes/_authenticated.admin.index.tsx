import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Smartphone,
  Contact,
  MessageSquare,
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { adminMetrics } from "@/utils/admin.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function fmtNumber(n: number) {
  return n.toLocaleString("pt-BR");
}

function fmtMoney(n: number) {
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function AdminDashboard() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-metrics"],
    enabled: !!accessToken,
    queryFn: () => adminMetrics({ data: { accessToken } }),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error instanceof Error ? error.message : "Erro ao carregar métricas"}
      </div>
    );
  }

  const m = data!;

  const stats = [
    {
      title: "Total de Usuários",
      value: fmtNumber(m.totalUsuarios),
      description: "cadastrados na plataforma",
      icon: Users,
    },
    {
      title: "WhatsApp Conectado",
      value: fmtNumber(m.whatsappConectado),
      description: "instâncias ativas",
      icon: Smartphone,
    },
    {
      title: "Contatos Cadastrados",
      value: fmtNumber(m.contatos),
      description: "total na plataforma",
      icon: Contact,
    },
    {
      title: "Mensagens (mês)",
      value: fmtNumber(m.enviadosMes),
      description: `${m.falhasMes} falhas`,
      icon: MessageSquare,
    },
    {
      title: "Taxa de Sucesso",
      value: `${m.taxaSucesso}%`,
      description: "envios bem-sucedidos no mês",
      icon: CheckCircle,
    },
    {
      title: "Assinaturas Ativas",
      value: fmtNumber(m.assinaturasAtivas),
      description: "clientes pagantes",
      icon: CreditCard,
    },
    {
      title: "MRR",
      value: fmtMoney(m.mrr),
      description: "receita recorrente mensalizada",
      icon: DollarSign,
    },
    {
      title: "Receita estimada anual",
      value: fmtMoney(m.mrr * 12),
      description: "projeção 12 meses",
      icon: TrendingUp,
    },
  ];

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
