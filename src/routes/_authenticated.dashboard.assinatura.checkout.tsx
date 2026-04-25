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

interface Plano {
  id: string;
  slug: "mensal" | "anual";
  nome: string;
  valor: number;
  ciclo: string;
  descricao: string | null;
}

function CheckoutPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const accessToken = session?.access_token ?? "";

  const [planoSlug, setPlanoSlug] = useState<"mensal" | "anual">("anual");
  const [billingType, setBillingType] = useState<
    "PIX" | "BOLETO" | "CREDIT_CARD"
  >("PIX");
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
      toast.success("Assinatura criada! Verifique sua fatura.");
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Escolha seu plano</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pagamento processado de forma segura via Asaas
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {planos.map((p) => {
          const selected = p.slug === planoSlug;
          return (
            <Card
              key={p.id}
              className={`cursor-pointer p-6 transition-all ${
                selected
                  ? "ring-2 ring-primary"
                  : "border-border hover:border-primary/40"
              }`}
              onClick={() => setPlanoSlug(p.slug)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{p.nome}</h3>
                  <p className="text-sm text-muted-foreground">
                    {p.descricao}
                  </p>
                </div>
                {selected && (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold">
                  R$ {Number(p.valor).toLocaleString("pt-BR")}
                </span>
                <span className="text-sm text-muted-foreground">
                  /{p.ciclo === "anual" ? "ano" : "mês"}
                </span>
              </div>
              {p.slug === "anual" && (
                <Badge className="mt-3" variant="secondary">
                  Economia de R$ 167/ano
                </Badge>
              )}
            </Card>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-4 p-6">
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
              onValueChange={(v) =>
                setBillingType(v as "PIX" | "BOLETO" | "CREDIT_CARD")
              }
              className="grid gap-2 sm:grid-cols-3"
            >
              {[
                { v: "PIX", l: "PIX" },
                { v: "BOLETO", l: "Boleto" },
                { v: "CREDIT_CARD", l: "Cartão" },
              ].map((opt) => (
                <Label
                  key={opt.v}
                  htmlFor={`bt-${opt.v}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 ${
                    billingType === opt.v
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <RadioGroupItem id={`bt-${opt.v}`} value={opt.v} />
                  <span className="text-sm font-medium">{opt.l}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar assinatura
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Ambiente sandbox. Use CPF de teste para validar o fluxo.
          </p>
        </Card>
      </form>
    </div>
  );
}
