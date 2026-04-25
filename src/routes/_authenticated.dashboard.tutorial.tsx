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
  dica?: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    icon: Smartphone,
    title: "Conecte o WhatsApp do consultório",
    intro:
      "Primeiro, você precisa avisar para o sistema qual WhatsApp vai enviar as mensagens.",
    detalhe:
      "Vá em 'Aniversários' → aba 'WhatsApp' → clique em 'Conectar WhatsApp'. Vai aparecer um QR Code igual o que você usa para entrar no WhatsApp Web. Aponte a câmera do celular para o código e pronto. O WhatsApp fica conectado mesmo se você desligar o computador.",
    dica: "Use um WhatsApp separado do seu pessoal (pode ser um chip novo ou o WhatsApp Business da clínica). Assim seus pacientes não te veem como contato pessoal e suas mensagens ficam organizadas.",
  },
  {
    num: 2,
    icon: Upload,
    title: "Suba sua planilha de pacientes",
    intro:
      "O sistema precisa saber o nome, telefone e data de nascimento de cada paciente.",
    detalhe:
      "Na aba 'Contatos', clique em 'Importar planilha'. Aceitamos arquivo Excel (.xlsx) ou CSV. As colunas precisam ser: Nome, Telefone, Data de Nascimento. Depois de subir, o sistema mostra quantos pacientes foram importados e se algum tem dado faltando.",
    dica: "Não tem planilha pronta? Você pode adicionar pacientes um por um clicando em 'Novo contato'.",
  },
  {
    num: 3,
    icon: MessageSquare,
    title: "Escreva a mensagem de aniversário",
    intro:
      "Defina o que o sistema vai mandar quando for aniversário de cada paciente.",
    detalhe:
      "Na aba 'Mensagem', escreva o texto da mensagem. Use {{nome}} para que o sistema substitua pelo primeiro nome do paciente automaticamente. Por exemplo: 'Olá {{nome}}, parabéns! 🎉 A equipe da Dra. Maria deseja um dia maravilhoso.' Você pode anexar uma imagem também (foto da clínica, cartão de aniversário, etc.).",
    dica: "Capriche no carinho da mensagem. Pacientes que recebem uma mensagem personalizada têm muito mais chance de marcar consulta.",
  },
  {
    num: 4,
    icon: Send,
    title: "Ative o envio automático",
    intro:
      "Tudo pronto. Agora é só ligar o sistema e relaxar.",
    detalhe:
      "Na aba 'Envio', escolha o horário em que você quer que as mensagens sejam disparadas (ex: 8h da manhã). Ative o envio automático. Todo dia, no horário que você escolheu, o sistema verifica quem faz aniversário e envia a mensagem sozinho.",
    dica: "Você pode pausar o envio quando quiser. Ele continua de onde parou quando você reativar.",
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
            Em 4 passos simples, você automatiza as mensagens de aniversário
            dos seus pacientes.
          </p>
        </div>
        <Badge variant="secondary">Tempo: 5 min</Badge>
      </div>

      {/* Visão geral */}
      <Card className="bg-primary/5 p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-foreground">
          O Dental Hub é um sistema que envia mensagens de WhatsApp para seus
          pacientes <strong>automaticamente</strong>, sem você precisar fazer
          nada todos os dias. Você configura uma vez e ele cuida do resto.
        </p>
      </Card>

      {/* Passo a passo */}
      <div className="space-y-4">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <Card key={step.num} className="overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                <div className="flex items-center gap-3 bg-primary/5 p-4 sm:w-48 sm:flex-col sm:items-start sm:justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                    {step.num}
                  </div>
                  <Icon className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
                </div>
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
                  {step.dica && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
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
