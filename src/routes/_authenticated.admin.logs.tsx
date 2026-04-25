import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminLogs } from "@/utils/admin.functions";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
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
import { formatDateTimeBR } from "@/lib/date-format";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: AdminLogs,
});

function AdminLogs() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [filtro, setFiltro] = useState<"todos" | "enviado" | "falha_envio">(
    "todos",
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-logs", filtro],
    enabled: !!accessToken,
    queryFn: () =>
      adminLogs({ data: { accessToken, limit: 100, filtroStatus: filtro } }),
    refetchInterval: 30_000,
  });

  const envios = data?.envios ?? [];
  const totalEnviados = envios.filter((e) => e.status === "enviado").length;
  const totalErros = envios.filter((e) => e.status === "falha_envio").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Monitoramento do Sistema
        </h1>
        <p className="mt-1 text-muted-foreground">
          Logs de envios, erros e automações (últimos 100 registros)
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
        value={filtro}
        onValueChange={(v) =>
          setFiltro(v as "todos" | "enviado" | "falha_envio")
        }
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="enviado">Enviados</TabsTrigger>
          <TabsTrigger value="falha_envio">Falhas</TabsTrigger>
        </TabsList>

        <TabsContent value={filtro}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logs de Envio</CardTitle>
              <CardDescription>
                Histórico de mensagens enviadas pela plataforma
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : envios.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum log encontrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {envios.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-muted-foreground">
                          {formatDateTimeBR(e.created_at)}
                        </TableCell>
                        <TableCell>{e.email}</TableCell>
                        <TableCell>{e.telefone}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              e.status === "enviado" ? "default" : "destructive"
                            }
                          >
                            {e.status === "enviado" ? "Enviado" : "Falha"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
