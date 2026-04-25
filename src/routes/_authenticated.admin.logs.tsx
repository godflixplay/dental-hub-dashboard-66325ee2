import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminLogs } from "@/utils/admin.functions";
import {
  AlertTriangle,
  CalendarIcon,
  CheckCircle,
  ChevronDown,
  Loader2,
  Users as UsersIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatDateTimeBR, formatDateBR } from "@/lib/date-format";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: AdminLogs,
});

type FiltroStatus = "todos" | "enviado" | "falha_envio";
type FiltroPeriodo = "hoje" | "7d" | "30d" | "mes" | "personalizado";

function getRange(periodo: FiltroPeriodo, custom?: { from?: Date; to?: Date }) {
  const now = new Date();
  const fim = new Date(now);
  fim.setHours(23, 59, 59, 999);
  const inicio = new Date(now);

  switch (periodo) {
    case "hoje":
      inicio.setHours(0, 0, 0, 0);
      break;
    case "7d":
      inicio.setDate(now.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
      break;
    case "30d":
      inicio.setDate(now.getDate() - 30);
      inicio.setHours(0, 0, 0, 0);
      break;
    case "mes":
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
      break;
    case "personalizado": {
      const from = custom?.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
      const to = custom?.to ?? now;
      const i = new Date(from);
      i.setHours(0, 0, 0, 0);
      const f = new Date(to);
      f.setHours(23, 59, 59, 999);
      return { dataInicio: i.toISOString(), dataFim: f.toISOString() };
    }
  }
  return { dataInicio: inicio.toISOString(), dataFim: fim.toISOString() };
}

function AdminLogs() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [periodo, setPeriodo] = useState<FiltroPeriodo>("7d");
  const [customRange, setCustomRange] = useState<{ from?: Date; to?: Date }>({});

  const range = useMemo(
    () => getRange(periodo, customRange),
    [periodo, customRange],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", filtroStatus, range.dataInicio, range.dataFim],
    enabled: !!accessToken,
    queryFn: () =>
      adminLogs({
        data: {
          accessToken,
          limit: 1000,
          filtroStatus,
          dataInicio: range.dataInicio,
          dataFim: range.dataFim,
        },
      }),
    refetchInterval: 60_000,
  });

  const grupos = data?.grupos ?? [];
  const envios = data?.envios ?? [];
  const totalEnviados = envios.filter((e) => e.status === "enviado").length;
  const totalErros = envios.filter((e) => e.status === "falha_envio").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Monitoramento de Envios
        </h1>
        <p className="mt-1 text-muted-foreground">
          Logs de envios agrupados por usuário, com filtros por período e
          status.
        </p>
      </div>

      {/* Filtros de período */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Button
            variant={periodo === "hoje" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo("hoje")}
          >
            Hoje
          </Button>
          <Button
            variant={periodo === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo("7d")}
          >
            Últimos 7 dias
          </Button>
          <Button
            variant={periodo === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo("30d")}
          >
            Últimos 30 dias
          </Button>
          <Button
            variant={periodo === "mes" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriodo("mes")}
          >
            Este mês
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={periodo === "personalizado" ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <CalendarIcon className="h-4 w-4" />
                {periodo === "personalizado" && customRange.from
                  ? `${formatDateBR(customRange.from.toISOString())}${customRange.to ? ` → ${formatDateBR(customRange.to.toISOString())}` : ""}`
                  : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: customRange.from, to: customRange.to }}
                onSelect={(r) => {
                  setCustomRange({ from: r?.from, to: r?.to });
                  setPeriodo("personalizado");
                }}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDateBR(range.dataInicio)} → {formatDateBR(range.dataFim)}
          </span>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{envios.length}</div>
            <p className="text-xs text-muted-foreground">
              {grupos.length} usuário(s)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
            <CheckCircle className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnviados}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Falhas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErros}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={filtroStatus}
        onValueChange={(v) => setFiltroStatus(v as FiltroStatus)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="enviado">Enviados</TabsTrigger>
          <TabsTrigger value="falha_envio">Falhas</TabsTrigger>
        </TabsList>

        <TabsContent value={filtroStatus}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logs por usuário</CardTitle>
              <CardDescription>
                Clique em um usuário para expandir os envios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : grupos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum log encontrado neste período.
                </p>
              ) : (
                <Accordion type="multiple" className="space-y-2">
                  {grupos.map((g) => (
                    <AccordionItem
                      key={g.user_id}
                      value={g.user_id}
                      className="rounded-md border px-3"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex flex-1 items-center justify-between gap-4 pr-2">
                          <div className="flex flex-col items-start text-left">
                            <span className="font-medium">
                              {g.nome_responsavel ?? g.email}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {g.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="outline">{g.total} total</Badge>
                            <Badge
                              variant="default"
                              className="bg-accent/20 text-accent hover:bg-accent/30"
                            >
                              {g.enviados} ok
                            </Badge>
                            {g.falhas > 0 && (
                              <Badge variant="destructive">
                                {g.falhas} falha(s)
                              </Badge>
                            )}
                            {g.ultimoEnvio && (
                              <span className="hidden text-muted-foreground sm:inline">
                                Último: {formatDateTimeBR(g.ultimoEnvio)}
                              </span>
                            )}
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Contato</TableHead>
                              <TableHead>Telefone</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {g.envios.map((e) => (
                              <TableRow key={e.id}>
                                <TableCell className="text-muted-foreground">
                                  {formatDateTimeBR(e.created_at)}
                                </TableCell>
                                <TableCell>{e.nome ?? "—"}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {e.telefone}
                                </TableCell>
                                <TableCell>
                                  {e.status === "falha_envio" && e.erro ? (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="destructive">
                                            Falha
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent
                                          side="top"
                                          className="max-w-xs text-xs"
                                        >
                                          {e.erro}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <Badge
                                      variant={
                                        e.status === "enviado"
                                          ? "default"
                                          : "outline"
                                      }
                                    >
                                      {e.status === "enviado"
                                        ? "Enviado"
                                        : e.status}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
