import { createFileRoute, Navigate } from "@tanstack/react-router";
import {
  Sparkles,
  Calendar,
  UserPlus,
  Star,
  Check,
  ShoppingCart,
  Settings,
  Send,
  RotateCw,
  ShieldCheck,
  Clock,
  TrendingUp,
  PartyPopper,
  Users,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import heroDentist from "@/assets/hero-dentist.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      {
        title: "DentalHub — Automações de WhatsApp para clínicas odontológicas",
      },
      {
        name: "description",
        content:
          "Transforme sua clínica em uma máquina automática de relacionamento. Mensagens de aniversário, lembretes e reativação de pacientes via WhatsApp.",
      },
    ],
  }),
});

function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return <LandingPage />;
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <Services />
        <HowItWorks />
        <Benefits />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ---------------- Header ---------------- */
function Header() {
  const navItems = [
    "Início",
    "Serviços",
    "Como funciona",
    "Benefícios",
    "Depoimentos",
    "Planos",
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex">
          {navItems.map((item) => (
            <button
              key={item}
              type="button"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden sm:inline-flex">
            Login
          </Button>
          <Button className="rounded-full px-5">Começar agora</Button>
        </div>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-5 w-5" />
      </div>
      <span className="text-xl font-bold tracking-tight">
        DENTAL<span className="text-primary">HUB</span>
      </span>
    </div>
  );
}

/* ---------------- Hero ---------------- */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-8">
          {/* Left: copy */}
          <div className="relative z-10">
            <Badge
              variant="secondary"
              className="mb-6 rounded-full bg-secondary/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
            >
              Hub de soluções para clínicas odontológicas
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Transforme sua clínica em uma máquina automática de{" "}
              <span className="text-primary">relacionamento.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Ferramentas simples, práticas e prontas para usar que ajudam você
              a fidelizar pacientes e aumentar o faturamento — sem complicação.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="group h-12 rounded-full px-7 text-base"
              >
                Começar agora
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="group h-12 rounded-full px-7 text-base"
              >
                Ver serviços disponíveis
                <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <FeatureCheck icon={ShieldCheck} label="Sem instalação" />
              <FeatureCheck icon={Clock} label="Ativação em minutos" />
              <FeatureCheck icon={Sparkles} label="Suporte especializado" />
            </div>
          </div>

          {/* Right: image + floating cards */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-3xl bg-secondary/40">
              <img
                src={heroDentist}
                alt="Dentista profissional sorrindo em consultório odontológico moderno"
                width={1024}
                height={1024}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Floating card 1 */}
            <Card className="absolute -left-4 top-8 hidden w-64 gap-0 border-border/60 p-4 shadow-xl sm:block lg:-left-10">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <PartyPopper className="h-5 w-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">
                    Mensagem de aniversário enviada!
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Hoje, 15 mensagens foram enviadas.
                  </p>
                  <Badge className="mt-2 gap-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15">
                    <Check className="h-3 w-3" /> Sucesso
                  </Badge>
                </div>
              </div>
            </Card>

            {/* Floating card 2 */}
            <Card className="absolute -right-4 bottom-8 hidden w-64 gap-2 border-border/60 p-4 shadow-xl sm:block lg:-right-10">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Pacientes ativos
              </div>
              <div className="text-3xl font-bold tracking-tight">1.248</div>
              <div className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                +32 este mês
              </div>
              <MiniSparkline />
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureCheck({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <span className="font-medium">{label}</span>
    </div>
  );
}

function MiniSparkline() {
  return (
    <svg
      viewBox="0 0 100 30"
      className="mt-1 h-8 w-full text-primary"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M0 22 L15 18 L30 20 L45 12 L60 14 L75 8 L90 6 L100 4" />
    </svg>
  );
}

/* ---------------- Social proof ---------------- */
function SocialProof() {
  const clinics = [
    "SorrisoPerfeito",
    "OralTop",
    "Vitalle",
    "NovaOdonto",
    "PrimeSmile",
  ];
  return (
    <section className="border-y border-border bg-background py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Clínicas que já confiam no DentalHub
        </p>
        <div className="mt-8 grid grid-cols-2 items-center gap-6 sm:grid-cols-3 md:grid-cols-5">
          {clinics.map((c) => (
            <div
              key={c}
              className="flex items-center justify-center gap-2 text-muted-foreground/70"
            >
              <Sparkles className="h-5 w-5" />
              <span className="text-base font-semibold tracking-tight">
                {c}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Services ---------------- */
function Services() {
  const services = [
    {
      icon: PartyPopper,
      title: "Mensagens de Aniversário",
      description:
        "Envie mensagens automáticas e personalizadas para seus pacientes no dia do aniversário.",
      bullets: [
        "Relacionamento mais próximo",
        "Mais retorno de pacientes",
        "Totalmente automático",
      ],
      active: true,
    },
    {
      icon: Calendar,
      title: "Lembrete de Consultas",
      description:
        "Reduza faltas enviando lembretes automáticos de consultas via WhatsApp.",
      active: false,
    },
    {
      icon: UserPlus,
      title: "Reativação de Pacientes",
      description:
        "Recupere pacientes que não retornam há algum tempo com campanhas automáticas.",
      active: false,
    },
    {
      icon: Star,
      title: "Pedido de Avaliação Google",
      description:
        "Peça avaliações automaticamente e melhore sua reputação online.",
      active: false,
    },
  ];

  return (
    <section className="bg-secondary/40 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Serviços disponíveis
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Soluções que simplificam o dia a dia da sua clínica
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s) => (
            <ServiceCard key={s.title} {...s} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  description,
  bullets,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  bullets?: string[];
  active: boolean;
}) {
  return (
    <Card
      className={`relative gap-0 border-border/60 p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${
        active ? "ring-2 ring-primary/30" : ""
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          active
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {bullets && (
        <ul className="mt-4 space-y-2">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {active ? (
          <Button className="w-full rounded-full">Ativar serviço</Button>
        ) : (
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1 text-xs font-medium text-primary"
          >
            Em breve
          </Badge>
        )}
      </div>
    </Card>
  );
}

/* ---------------- How it works ---------------- */
function HowItWorks() {
  const steps = [
    {
      icon: ShoppingCart,
      title: "Escolha o serviço",
      description: "Selecione a solução ideal para sua clínica.",
    },
    {
      icon: Settings,
      title: "Configure em minutos",
      description: "A configuração é simples, intuitiva e guiada.",
    },
    {
      icon: Send,
      title: "Deixe o sistema trabalhar por você",
      description:
        "Automatize processos e tenha mais tempo para o que importa.",
    },
  ];

  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            Como funciona
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Ativar é rápido e simples
          </h2>
        </div>

        <div className="relative mt-14 grid gap-10 md:grid-cols-3">
          {/* dotted connector */}
          <div
            className="pointer-events-none absolute left-0 right-0 top-7 hidden md:block"
            aria-hidden="true"
          >
            <svg
              className="mx-auto h-2 w-2/3 text-border"
              preserveAspectRatio="none"
              viewBox="0 0 100 2"
            >
              <line
                x1="0"
                y1="1"
                x2="100"
                y2="1"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeDasharray="2 2"
              />
            </svg>
          </div>

          {steps.map((s, i) => (
            <div key={s.title} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
                <span className="text-lg font-bold">{i + 1}</span>
              </div>
              <div className="mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary text-primary">
                <s.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Benefits ---------------- */
function Benefits() {
  const benefits = [
    { icon: RotateCw, label: "Mais pacientes voltando" },
    { icon: ShieldCheck, label: "Mais profissionalismo" },
    { icon: Clock, label: "Menos trabalho manual" },
    { icon: TrendingUp, label: "Mais faturamento" },
  ];

  return (
    <section className="bg-secondary/40 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-primary">
          Benefícios para sua clínica
        </p>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.label} className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm">
                <b.icon className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold leading-tight">{b.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */
function FinalCta() {
  return (
    <section className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-3xl bg-primary px-8 py-12 text-primary-foreground shadow-xl sm:px-12 sm:py-14">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-xl">
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              Comece agora com mensagens automáticas de aniversário
            </h2>
            <p className="mt-3 text-sm text-primary-foreground/80 sm:text-base">
              Fortaleça o relacionamento com seus pacientes e veja a diferença
              nos resultados da sua clínica.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Button
              size="lg"
              variant="secondary"
              className="group h-12 rounded-full px-7 text-base font-semibold text-primary"
            >
              Testar agora gratuitamente
              <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <p className="text-xs text-primary-foreground/70">
              Teste grátis por 7 dias. Cancelamento fácil.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Footer ---------------- */
function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <Logo />
        <p>© {new Date().getFullYear()} DentalHub. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
