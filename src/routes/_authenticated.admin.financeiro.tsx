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
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const [pinging, setPinging] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);

  async function handlePing() {
    if (!accessToken) {
      toast.error("Sessão expirada");
      return;
    }
    setPinging(true);
    try {
      const res = (await pingAsaas({ data: { accessToken } })) as PingResult;
      setPingResult(res);
      if (res.ok) {
        toast.success(`Conectado ao Asaas (${res.env})`);
      } else {
        toast.error(`Falha: ${res.error ?? "erro desconhecido"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPingResult({ ok: false, env: "?", baseUrl: "?", error: msg });
      toast.error(msg);
    } finally {
      setPinging(false);
    }
  }

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
            <TrendingUp className="h-4 w-4 text-primary" />
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
          <CardTitle className="text-lg flex items-center gap-2">
            <PlugZap className="h-5 w-5" />
            Integração Asaas
          </CardTitle>
          <CardDescription>
            Teste a comunicação com a API do Asaas e veja qual ambiente está
            configurado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handlePing} disabled={pinging}>
            {pinging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testando...
              </>
            ) : (
              "Testar conexão"
            )}
          </Button>

          {pingResult && (
            <div className="rounded-md border p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                {pingResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="font-medium">
                  {pingResult.ok ? "Conectado" : "Falha na conexão"}
                </span>
                <Badge variant="outline">{pingResult.env}</Badge>
              </div>
              <div className="text-muted-foreground">
                <span className="font-mono text-xs">{pingResult.baseUrl}</span>
              </div>
              {pingResult.ok && pingResult.account && (
                <div className="grid gap-1 pt-2 border-t">
                  <div>
                    <span className="text-muted-foreground">Conta:</span>{" "}
                    {pingResult.account.name ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>{" "}
                    {pingResult.account.email ?? "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Wallet ID:</span>{" "}
                    <span className="font-mono text-xs">
                      {pingResult.account.walletId ?? "—"}
                    </span>
                  </div>
                </div>
              )}
              {!pingResult.ok && pingResult.error && (
                <div className="text-destructive text-xs font-mono">
                  {pingResult.error}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
