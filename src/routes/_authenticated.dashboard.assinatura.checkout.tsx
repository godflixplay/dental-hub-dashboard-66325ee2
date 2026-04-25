import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { listarPlanos, criarAssinatura } from "@/utils/asaas.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/dashboard/assinatura/checkout",
)({
  component: CheckoutPage,
});

type PlanoSlug = "mensal" | "trimestral" | "semestral" | "anual";
type BillingType = "PIX" | "CREDIT_CARD";

interface Plano {
  id: string;
  slug: PlanoSlug;
  nome: string;
  valor: number;
  ciclo: string;
  descricao: string | null;
}

const CICLO_LABEL: Record<string, string> = {
  mensal: "/mês",
  trimestral: "/trimestre",
  semestral: "/semestre",
  anual: "/ano",
};

// Calcula desconto vs preço mensal cheio para badge "economia"
function economiaVsMensal(plano: Plano): string | null {
  const meses: Record<string, number> = {
    mensal: 1,
    trimestral: 3,
    semestral: 6,
    anual: 12,
  };
  const m = meses[plano.ciclo];
  if (!m || m === 1) return null;
  const cheio = 37 * m;
  const economia = cheio - plano.valor;
  if (economia <= 0) return null;
  return `Economize R$ ${economia.toFixed(2).replace(".", ",")}`;
}

function CheckoutPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const accessToken = session?.access_token ?? "";

  const [planoSlug, setPlanoSlug] = useState<PlanoSlug>("anual");
  const [billingType, setBillingType] = useState<BillingType>("PIX");
  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["planos"],
    enabled: !!accessToken,
    queryFn: () => listarPlanos({ data: { accessToken } }),
  });

  const planos = (data?.planos ?? []) as Plano[];
  const planoSelecionado = planos.find((p) => p.slug === planoSlug);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !cpfCnpj) {
      toast.error("Preencha nome e CPF/CNPJ");
      return;
    }
    setSubmitting(true);
    try {
      await criarAssinatura({
        data: {
          accessToken,
          planoSlug,
          billingType,
          nome,
          cpfCnpj,
          telefone: telefone || undefined,
        },
      });
      toast.success(
        billingType === "PIX"
          ? "Assinatura criada! Acesse 'Minha Assinatura' para ver o QR Code do PIX."
          : "Assinatura criada! Acesse 'Minha Assinatura' para concluir o pagamento.",
      );
      navigate({ to: "/dashboard/assinatura" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar assinatura");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Escolha seu plano</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagamento via PIX ou Cartão. Renovação automática.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {planos.map((p) => {
          const selected = p.slug === planoSlug;
          const eco = economiaVsMensal(p);
          return (
            <Card
              key={p.id}
              className={`cursor-pointer p-4 transition-all ${
                selected
                  ? "ring-2 ring-primary"
                  : "border-border hover:border-primary/40"
              }`}
              onClick={() => setPlanoSlug(p.slug)}
            >
              <div className="flex items-start justify-between">
                <h3 className="text-base font-bold">{p.nome}</h3>
                {selected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.descricao}
              </p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold">
                  R$ {Number(p.valor).toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {CICLO_LABEL[p.ciclo] ?? ""}
                </span>
              </div>
              {eco && (
                <Badge className="mt-2" variant="secondary">
                  {eco}
                </Badge>
              )}
            </Card>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 p-4 sm:p-6">
          <h2 className="text-lg font-semibold">Dados de cobrança</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="nome">Nome completo *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="cpfCnpj">CPF ou CNPJ *</Label>
              <Input
                id="cpfCnpj"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="000.000.000-00"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Forma de pagamento</Label>
            <RadioGroup
              value={billingType}
              onValueChange={(v) => setBillingType(v as BillingType)}
              className="grid gap-2 sm:grid-cols-2"
            >
              {[
                { v: "PIX" as const, l: "PIX", d: "Aprovação imediata" },
                {
                  v: "CREDIT_CARD" as const,
                  l: "Cartão de Crédito",
                  d: "Renovação automática no cartão",
                },
              ].map((opt) => (
                <Label
                  key={opt.v}
                  htmlFor={`bt-${opt.v}`}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                    billingType === opt.v
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem id={`bt-${opt.v}`} value={opt.v} />
                  <div>
                    <p className="text-sm font-medium">{opt.l}</p>
                    <p className="text-xs text-muted-foreground">{opt.d}</p>
                  </div>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {planoSelecionado && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>{planoSelecionado.nome}</span>
                <span className="font-semibold">
                  R${" "}
                  {Number(planoSelecionado.valor)
                    .toFixed(2)
                    .replace(".", ",")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {planoSelecionado.descricao} • Renovação automática.
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar assinatura
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Pagamento processado de forma segura via Asaas.
          </p>
        </Card>
      </form>
    </div>
  );
}
