import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Cake,
  Upload,
  Smartphone,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  CreditCard,
  ShieldCheck,
  Lock,
  QrCode,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/tutorial")({
  component: TutorialPage,
});

interface Step {
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  intro: string;
  detalhe: string;
  comoFazer: string[];
  dica?: string;
  seguranca?: string;
  /** Mockup visual da tela correspondente. */
  mockup: React.ReactNode;
}

// ----------------------------------------------------------
// Mockups visuais — pequenas representações das telas reais.
// ----------------------------------------------------------
function MockWindow({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2">
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 text-[10px] font-medium text-muted-foreground">
          {titulo}
        </span>
      </div>
      <div className="p-3 text-xs">{children}</div>
    </div>
  );
}

function HighlightBtn({
  children,
  pulse = true,
}: {
  children: React.ReactNode;
  pulse?: boolean;
}) {
  return (
    <span className="relative inline-flex">
      {pulse && (
        <span className="absolute inset-0 -m-0.5 animate-pulse rounded-md bg-primary/30 blur-sm" />
      )}
      <span className="relative inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
        {children}
      </span>
    </span>
  );
}

const STEPS: Step[] = [
  {
    num: 1,
    icon: CreditCard,
    title: "Escolha um plano e faça o pagamento",
    intro:
      "Antes de qualquer coisa, você precisa assinar um plano. Sem isso, o sistema fica travado.",
    detalhe:
      "Temos planos a partir de R$ 37 por mês. Você paga via PIX (rapidinho) ou cartão de crédito. Assim que o pagamento cair, o sistema libera todas as funções automaticamente. Não precisa esperar ninguém aprovar.",
    comoFazer: [
      "No menu lateral, clique em 'Assinatura'.",
      "Escolha o plano que combina com você (Mensal, Trimestral, Semestral ou Anual — quanto maior, mais desconto).",
      "Clique em 'Assinar' e escolha PIX ou Cartão.",
      "Pague o PIX no app do seu banco (ou preencha o cartão).",
      "Aguarde alguns segundos. Quando aparecer o ✓ verde, está liberado!",
    ],
    dica: "Quem leva o plano Anual economiza cerca de 20% no total. Bom se você já decidiu que vai usar o sistema de verdade.",
    mockup: (
      <MockWindow titulo="Assinatura">
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-border p-2">
              <p className="font-semibold">Mensal</p>
              <p className="text-muted-foreground">R$ 37,00</p>
            </div>
            <div className="rounded border-2 border-primary p-2">
              <p className="font-semibold">Anual</p>
              <p className="text-muted-foreground">R$ 355,20</p>
              <Badge className="mt-1 text-[9px]">-20%</Badge>
            </div>
          </div>
          <div className="flex justify-end">
            <HighlightBtn>Assinar com PIX</HighlightBtn>
          </div>
        </div>
      </MockWindow>
    ),
  },
  {
    num: 2,
    icon: Smartphone,
    title: "Conecte o WhatsApp do consultório",
    intro:
      "Agora você diz para o sistema qual número de WhatsApp vai enviar as mensagens.",
    detalhe:
      "É o seu próprio número que envia as mensagens. O paciente recebe normalmente, como se você tivesse mandado pelo celular. O sistema só funciona como um 'piloto automático' que aperta o botão por você no horário certo.",
    comoFazer: [
      "No menu lateral, clique em 'Aniversários'.",
      "Vá na primeira aba: 'WhatsApp'.",
      "Clique no botão azul 'Conectar WhatsApp'.",
      "Vai aparecer um QR Code (código quadrado).",
      "No celular, abra o WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho.",
      "Aponte a câmera para o QR Code que apareceu na tela.",
      "Pronto! Aparece um ✓ verde dizendo 'Conectado'.",
    ],
    seguranca:
      "É 100% seguro. É o mesmo mecanismo do WhatsApp Web (aquele que você usa no computador). Sua conta continua sua: só você lê as conversas no celular. O sistema só envia as mensagens de aniversário que você configurou — nada mais.",
    dica: "Use um chip separado do seu pessoal (pode ser o WhatsApp Business da clínica). Fica mais profissional e seus pacientes não te confundem com contato pessoal.",
    mockup: (
      <MockWindow titulo="Aniversários › WhatsApp">
        <div className="space-y-2">
          <div className="flex items-center justify-center rounded border border-dashed border-border bg-muted/20 p-4">
            <QrCode className="h-12 w-12 text-muted-foreground" />
          </div>
          <p className="text-center text-[10px] text-muted-foreground">
            Aponte a câmera do celular aqui
          </p>
          <div className="flex justify-end">
            <HighlightBtn pulse={false}>Conectar WhatsApp</HighlightBtn>
          </div>
        </div>
      </MockWindow>
    ),
  },
  {
    num: 3,
    icon: Upload,
    title: "Suba sua planilha de pacientes",
    intro:
      "O sistema precisa saber o nome, telefone e data de nascimento de cada paciente.",
    detalhe:
      "Você sobe uma planilha de Excel ou CSV com todos os pacientes de uma vez. O sistema cuida de identificar quem faz aniversário hoje, amanhã, na semana que vem... você não precisa fazer mais nada.",
    comoFazer: [
      "Vá em 'Aniversários' → aba 'Contatos'.",
      "Clique em 'Importar Planilha'.",
      "Selecione seu arquivo .xlsx ou .csv.",
      "As colunas precisam ser: Nome, Telefone, Data de Nascimento.",
      "Confira o preview que aparece e confirme.",
      "Pronto! O sistema mostra quantos pacientes foram importados.",
    ],
    dica: "Não tem planilha pronta? Use o botão 'Adicionar' para cadastrar paciente por paciente. Ou exporte do seu sistema de gestão (Dental Office, Clinicorp, Simples Dental, etc.).",
    mockup: (
      <MockWindow titulo="Aniversários › Contatos">
        <div className="space-y-2">
          <div className="flex justify-end gap-1">
            <span className="rounded border border-border px-2 py-0.5 text-[10px]">
              + Adicionar
            </span>
            <HighlightBtn pulse={false}>Importar Planilha</HighlightBtn>
          </div>
          <div className="space-y-1 rounded border border-border p-2">
            <div className="flex justify-between text-[10px]">
              <span>Maria Silva</span>
              <span className="text-muted-foreground">15/03</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>João Santos</span>
              <span className="text-muted-foreground">22/07</span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span>Ana Costa</span>
              <span className="text-muted-foreground">08/11</span>
            </div>
          </div>
        </div>
      </MockWindow>
    ),
  },
  {
    num: 4,
    icon: MessageSquare,
    title: "Escreva a mensagem de aniversário",
    intro:
      "Defina o que o sistema vai mandar quando for aniversário de cada paciente.",
    detalhe:
      "Você escreve a mensagem uma vez só. O sistema substitui o {{nome}} pelo nome real de cada paciente automaticamente. Se quiser, pode anexar uma imagem (foto da clínica, cartão bonito, etc.).",
    comoFazer: [
      "Vá em 'Aniversários' → aba 'Mensagem'.",
      "Escreva o texto. Use {{nome}} onde quiser que apareça o nome do paciente.",
      "Exemplo: 'Olá {{nome}}, parabéns pelo seu dia! 🎉 Equipe Dra. Maria.'",
      "Se quiser, clique em 'Anexar imagem' e envie uma foto.",
      "Clique em 'Salvar Configuração'.",
    ],
    dica: "Capricho na mensagem faz diferença. Pacientes que recebem mensagem personalizada têm muito mais chance de marcar consulta de avaliação.",
    mockup: (
      <MockWindow titulo="Aniversários › Mensagem">
        <div className="space-y-2">
          <div className="rounded border border-border bg-muted/20 p-2 text-[10px]">
            Olá <span className="font-semibold text-primary">{"{{nome}}"}</span>
            , parabéns pelo seu dia! 🎉
            <br />
            Um forte abraço da equipe Dra. Maria.
          </div>
          <div className="flex justify-end">
            <HighlightBtn pulse={false}>Salvar Configuração</HighlightBtn>
          </div>
        </div>
      </MockWindow>
    ),
  },
  {
    num: 5,
    icon: Send,
    title: "Ative o envio automático",
    intro: "Tudo pronto. Agora é só ligar o sistema e relaxar.",
    detalhe:
      "Você escolhe o horário em que o sistema vai disparar as mensagens (ex: 8h da manhã). Todo dia, no horário que você escolheu, ele verifica quem faz aniversário e envia a mensagem sozinho. Você pode pausar ou alterar quando quiser.",
    comoFazer: [
      "Vá em 'Aniversários' → aba 'Envio'.",
      "Escolha o horário de envio (recomendamos entre 8h e 10h).",
      "Confira o preview da mensagem que vai sair.",
      "Ative o envio automático.",
      "Acompanhe o histórico de envios na própria tela.",
    ],
    dica: "Você pode usar o botão 'Enviar Teste' para mandar a mensagem para o seu próprio número antes — assim você confere se está tudo certo.",
    mockup: (
      <MockWindow titulo="Aniversários › Envio">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded border border-border p-2 text-[10px]">
            <span>Horário de envio</span>
            <span className="font-semibold">08:00</span>
          </div>
          <div className="flex items-center justify-between rounded border border-border p-2 text-[10px]">
            <span>Envio automático</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] text-primary-foreground">
              Ativo
            </span>
          </div>
          <div className="flex justify-end">
            <HighlightBtn pulse={false}>Enviar Teste</HighlightBtn>
          </div>
        </div>
      </MockWindow>
    ),
  },
];

function TutorialPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Cake className="h-6 w-6 text-primary" />
            Como funciona o Dental Hub
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Em 5 passos simples, você automatiza as mensagens de aniversário
            dos seus pacientes.
          </p>
        </div>
        <Badge variant="secondary">Tempo: ~10 min</Badge>
      </div>

      {/* Visão geral */}
      <Card className="bg-primary/5 p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-foreground">
          O Dental Hub é um sistema que envia mensagens de WhatsApp para seus
          pacientes <strong>automaticamente</strong>, sem você precisar fazer
          nada todos os dias. Você configura uma vez e ele cuida do resto.
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/30 bg-background p-3 text-xs">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <strong>Importante:</strong> a ordem dos passos importa. Sem o
            passo 1 (assinar e pagar), os botões de conectar WhatsApp,
            importar planilha e ativar envio ficam bloqueados.
          </span>
        </div>
      </Card>

      {/* Passo a passo */}
      <div className="space-y-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.num} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Coluna esquerda — número + ícone */}
                <div className="flex items-center gap-3 bg-primary/5 p-4 sm:w-32 sm:flex-col sm:items-start sm:justify-start">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    {step.num}
                  </div>
                  <Icon className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
                </div>

                {/* Coluna direita — conteúdo */}
                <div className="flex-1 p-4 sm:p-5">
                  <h3 className="text-base font-semibold sm:text-lg">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step.intro}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground">
                    {step.detalhe}
                  </p>

                  {/* Como fazer + Mockup lado a lado */}
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Como fazer
                      </p>
                      <ol className="space-y-1.5 text-xs leading-relaxed text-foreground">
                        {step.comoFazer.map((item, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="font-semibold text-primary">
                              {i + 1}.
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Como vai aparecer
                      </p>
                      {step.mockup}
                    </div>
                  </div>

                  {/* Bloco de segurança (passo do WhatsApp) */}
                  {step.seguranca && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>
                        <strong>É seguro?</strong> {step.seguranca}
                      </span>
                    </div>
                  )}

                  {/* Dica */}
                  {step.dica && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        <strong>Dica:</strong> {step.dica}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Confirmação final */}
      <Card className="border-primary/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold">Pronto! Você terminou.</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              A partir de agora, todo aniversariante do dia recebe sua mensagem
              automaticamente. Você pode acompanhar tudo no painel
              'Aniversários'.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button asChild size="sm">
                <Link to="/dashboard/assinatura">
                  <CreditCard className="mr-1 h-4 w-4" />
                  Ver planos
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/aniversarios">
                  <Cake className="mr-1 h-4 w-4" />
                  Ir para Aniversários
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/faq">
                  <HelpCircle className="mr-1 h-4 w-4" />
                  Perguntas frequentes
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
