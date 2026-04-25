import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Smartphone,
  Contact,
  MessageSquare,
  DollarSign,
  TrendingUp,
  CreditCard,
  CheckCircle,
  Loader2,
  RefreshCw,
  WifiOff,
  Wifi,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import {
  adminEvolutionInstances,
  adminMetrics,
  adminRefreshInstanceStatus,
} from "@/utils/admin.functions";
import { formatDateTimeBR } from "@/lib/date-format";
import { cn } from "@/lib/utils";

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
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EvolutionMonitorCard accessToken={accessToken} />
    </div>
  );
}

function EvolutionMonitorCard({ accessToken }: { accessToken: string }) {
  const queryClient = useQueryClient();
  const [refreshingAll, setRefreshingAll] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-evolution-instances"],
    enabled: !!accessToken,
    queryFn: () => adminEvolutionInstances({ data: { accessToken } }),
    refetchInterval: 120_000,
  });

  const refreshOne = useMutation({
    mutationFn: (instanceName: string) =>
      adminRefreshInstanceStatus({
        data: { accessToken, instanceName },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin-evolution-instances"],
      }),
    onError: (err) =>
      toast.error(
        err instanceof Error ? err.message : "Erro ao atualizar status",
      ),
  });

  const instancias = data?.instancias ?? [];
  const conectadas = instancias.filter((i) => i.status === "connected").length;
  const desconectadas = instancias.length - conectadas;

  const refreshAll = async () => {
    if (refreshingAll || instancias.length === 0) return;
    setRefreshingAll(true);
    try {
      for (const i of instancias) {
        try {
          await adminRefreshInstanceStatus({
            data: { accessToken, instanceName: i.instance_name },
          });
        } catch {
          // segue
        }
      }
      await queryClient.invalidateQueries({
        queryKey: ["admin-evolution-instances"],
      });
      toast.success("Status atualizado para todas as instâncias.");
    } finally {
      setRefreshingAll(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="h-5 w-5 text-primary" />
            Monitoramento Evolution API
          </CardTitle>
          <CardDescription>
            {instancias.length} instância(s) — {conectadas} conectada(s),{" "}
            {desconectadas} sem conexão
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshAll}
          disabled={refreshingAll || instancias.length === 0}
          className="gap-2"
        >
          <RefreshCw
            className={cn("h-3 w-3", refreshingAll && "animate-spin")}
          />
          Atualizar todas
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : instancias.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma instância cadastrada ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Usuário</TableHead>
                <TableHead>Instância</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {instancias.map((i) => {
                const conectada = i.status === "connected";
                const conectando = i.status === "connecting";
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-block h-3 w-3 rounded-full",
                          conectada
                            ? "bg-accent shadow-[0_0_0_3px_hsl(var(--accent)/0.2)]"
                            : conectando
                              ? "bg-amber-500"
                              : "bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.2)]",
                        )}
                        aria-label={i.status}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {i.nome_responsavel ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {i.email}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {i.instance_name}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                          conectada
                            ? "bg-accent/15 text-accent"
                            : conectando
                              ? "bg-amber-500/15 text-amber-600"
                              : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {conectada ? (
                          <Wifi className="h-3 w-3" />
                        ) : (
                          <WifiOff className="h-3 w-3" />
                        )}
                        {conectada
                          ? "Conectado"
                          : conectando
                            ? "Conectando"
                            : "Desconectado"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.updated_at ? formatDateTimeBR(i.updated_at) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => refreshOne.mutate(i.instance_name)}
                        disabled={
                          refreshOne.isPending &&
                          refreshOne.variables === i.instance_name
                        }
                        title="Checar agora"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            refreshOne.isPending &&
                              refreshOne.variables === i.instance_name &&
                              "animate-spin",
                          )}
                        />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
