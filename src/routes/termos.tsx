import { createFileRoute, Link } from "@tanstack/react-router";
import termosMd from "@/content/legal/termos.md?raw";
import { Markdown } from "@/components/Markdown";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — Dental Hub" },
      {
        name: "description",
        content:
          "Termos de uso da plataforma Dental Hub: planos, cancelamento, responsabilidades.",
      },
      { property: "og:title", content: "Termos de Uso — Dental Hub" },
      {
        property: "og:description",
        content: "Regras de uso, planos, cancelamento e responsabilidades.",
      },
    ],
  }),
});

function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <Markdown source={termosMd} />
      <p className="mt-8 text-sm text-muted-foreground">
        Veja também a{" "}
        <Link to="/privacidade" className="text-primary hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </LegalLayout>
  );
}
