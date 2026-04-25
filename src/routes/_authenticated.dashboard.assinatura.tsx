import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import {
  getMinhaAssinatura,
  cancelarAssinatura,
} from "@/utils/asaas.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR, formatDateTimeBR } from "@/lib/date-format";

export const Route = createFileRoute("/_authenticated/dashboard/assinatura")({
  component: MinhaAssinaturaPage,
});

function statusVariant(status: string) {
  switch (status) {
    case "ativa":
      return "default" as const;
    case "trial":
      return "secondary" as const;
    case "atrasada":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function statusLabel(status: string) {
  return (
    {
      ativa: "Ativa",
      trial: "Período de teste",
      atrasada: "Atrasada",
      cancelada: "Cancelada",
      expirada: "Expirada",
    }[status] ?? status
  );
}

function pagamentoStatusLabel(status: string) {
  return (
    {
      RECEIVED: "Recebido",
      CONFIRMED: "Confirmado",
      PENDING: "Pendente",
      OVERDUE: "Atrasado",
      REFUNDED: "Estornado",
    }[status] ?? status
  );
}

function MinhaAssinaturaPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const accessToken = session?.access_token ?? "";
  const [cancelling, setCancelling] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["minha-assinatura"],
    enabled: !!accessToken,
    queryFn: () => getMinhaAssinatura({ data: { accessToken } }),
  });

  async function handleCancelar() {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) return;
    setCancelling(true);
    try {
      await cancelarAssinatura({ data: { accessToken } });
      toast.success("Assinatura cancelada");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar");
    } finally {
      setCancelling(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const assinatura = data?.assinatura;
  const pagamentos = data?.pagamentos ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Minha Assinatura</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seu plano e veja o histórico de pagamentos
          </p>
        </div>
      </div>

      {!assinatura ? (
        <Card>
          <CardHeader>
            <CardTitle>Você ainda não tem uma assinatura ativa</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Escolha um plano para liberar todos os recursos do Dental Hub.
            </p>
            <Button onClick={() => navigate({ to: "/dashboard/assinatura/checkout" })}>
              <CreditCard className="mr-2 h-4 w-4" /> Ver planos
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>
                  Plano{" "}
                  {(assinatura as { planos?: { nome?: string } }).planos
                    ?.nome ?? ""}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Próxima cobrança:{" "}
                  {assinatura.proxima_cobranca
                    ? formatDateBR(assinatura.proxima_cobranca)
                    : "—"}
                </p>
              </div>
              <Badge variant={statusVariant(assinatura.status)}>
                {statusLabel(assinatura.status)}
              </Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {(assinatura.status === "ativa" ||
                assinatura.status === "atrasada") && (
                <Button
                  variant="outline"
                  onClick={handleCancelar}
                  disabled={cancelling}
                >
                  {cancelling && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Cancelar assinatura
                </Button>
              )}
              {assinatura.status === "cancelada" && (
                <Button onClick={() => navigate({ to: "/dashboard/assinatura/checkout" })}>
                  Reativar
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {pagamentos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum pagamento registrado ainda
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Forma</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagamentos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {formatDateTimeBR(p.data_pagamento ?? p.created_at)}
                        </TableCell>
                        <TableCell>
                          R${" "}
                          {Number(p.valor).toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>{p.billing_type ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {pagamentoStatusLabel(p.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.invoice_url && (
                            <a
                              href={p.invoice_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
