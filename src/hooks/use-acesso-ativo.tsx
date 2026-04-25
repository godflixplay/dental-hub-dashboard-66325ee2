import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getMinhaAssinatura } from "@/utils/asaas.functions";

export type AcessoAtivoStatus =
  | "loading"
  | "sem_assinatura"
  | "aguardando_pagamento"
  | "expirada"
  | "ativa"
  | "cancelada_com_acesso";

export interface AcessoAtivoState {
  loading: boolean;
  ativo: boolean;
  status: AcessoAtivoStatus;
  acessoAte: string | null;
  /** Mensagem curta para mostrar em badges/avisos. */
  mensagem: string;
}

/**
 * Hook que decide se o usuário tem acesso liberado para usar as
 * automações (conectar WhatsApp, importar contatos, ativar envio).
 *
 * Regra: só libera quando há uma assinatura E pelo menos 1 pagamento
 * com status confirmado/recebido. Assinatura cancelada continua tendo
 * acesso até a data `proxima_cobranca` (regra "soft cancel").
 */
export function useAcessoAtivo(): AcessoAtivoState {
  const { session } = useAuth();
  const accessToken = session?.access_token;

  const { data, isLoading } = useQuery({
    queryKey: ["acesso-ativo", accessToken],
    enabled: !!accessToken,
    queryFn: () => getMinhaAssinatura({ data: { accessToken: accessToken! } }),
    staleTime: 30_000,
  });

  if (!accessToken || isLoading) {
    return {
      loading: true,
      ativo: false,
      status: "loading",
      acessoAte: null,
      mensagem: "Verificando assinatura...",
    };
  }

  const assinatura = data?.assinatura as
    | {
        status: string;
        proxima_cobranca: string | null;
      }
    | null;
  const pagamentos = (data?.pagamentos ?? []) as Array<{
    status?: string | null;
  }>;

  if (!assinatura) {
    return {
      loading: false,
      ativo: false,
      status: "sem_assinatura",
      acessoAte: null,
      mensagem:
        "Assine um plano para liberar o acesso às automações.",
    };
  }

  // Considera pagamento "ok" qualquer status que indique pagamento recebido
  // pelo Asaas. Isso inclui CONFIRMED, RECEIVED e variações em maiúsculas.
  const STATUS_PAGOS = new Set([
    "CONFIRMED",
    "RECEIVED",
    "RECEIVED_IN_CASH",
    "confirmed",
    "received",
    "pago",
    "confirmado",
  ]);
  const temPagamentoConfirmado = pagamentos.some((p) =>
    STATUS_PAGOS.has((p.status ?? "").trim()),
  );

  const hoje = new Date().toISOString().slice(0, 10);
  const dentroDaJanela =
    !!assinatura.proxima_cobranca && assinatura.proxima_cobranca >= hoje;

  // Cancelada mas dentro da janela paga
  if (assinatura.status === "cancelada") {
    if (dentroDaJanela && temPagamentoConfirmado && assinatura.proxima_cobranca) {
      return {
        loading: false,
        ativo: true,
        status: "cancelada_com_acesso",
        acessoAte: assinatura.proxima_cobranca,
        mensagem: `Assinatura cancelada. Acesso liberado até ${formatDate(assinatura.proxima_cobranca)}.`,
      };
    }
    return {
      loading: false,
      ativo: false,
      status: "expirada",
      acessoAte: null,
      mensagem:
        "Sua assinatura expirou. Reative um plano para voltar a usar.",
    };
  }

  // Ativa/atrasada/trial mas SEM pagamento confirmado ainda
  if (!temPagamentoConfirmado) {
    return {
      loading: false,
      ativo: false,
      status: "aguardando_pagamento",
      acessoAte: null,
      mensagem:
        "Aguardando confirmação do pagamento. Assim que cair, liberamos seu acesso.",
    };
  }

  return {
    loading: false,
    ativo: true,
    status: "ativa",
    acessoAte: assinatura.proxima_cobranca,
    mensagem: "Acesso ativo.",
  };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
