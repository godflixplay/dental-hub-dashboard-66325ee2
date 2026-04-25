import { createFileRoute } from "@tanstack/react-router";
import {
  DollarSign,
  Users,
  TrendingUp,
  TrendingDown,
  Loader2,
  PlugZap,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { pingAsaas } from "@/utils/asaas.functions";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  component: AdminFinanceiro,
});

interface PingResult {
  ok: boolean;
  env: string;
  baseUrl: string;
  account?: {
    email: string | null;
    name: string | null;
    walletId: string | null;
  };
  error?: string;
}

function AdminFinanceiro() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Gestão Financeira
        </h1>
        <p className="mt-1 text-muted-foreground">
          Faturamento, assinaturas e métricas financeiras
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Assinaturas Ativas
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">planos pagos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Faturamento Mensal
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ —</div>
            <p className="text-xs text-muted-foreground">mês atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Faturamento Total
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ —</div>
            <p className="text-xs text-muted-foreground">acumulado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Cancelamentos
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">este mês</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita Mensal</CardTitle>
            <CardDescription>Evolução do faturamento</CardDescription>
          </CardHeader>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            Gráfico disponível quando houver dados
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crescimento de Usuários</CardTitle>
            <CardDescription>Novos cadastros vs cancelamentos</CardDescription>
          </CardHeader>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            Gráfico disponível quando houver dados
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Integração de Pagamentos</CardTitle>
          <CardDescription>
            Estrutura preparada para integração com Stripe ou outro gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-24 items-center justify-center text-muted-foreground">
          Integração será configurada em breve
        </CardContent>
      </Card>
    </div>
  );
}
