import { createFileRoute, Link } from "@tanstack/react-router";
import privacidadeMd from "@/content/legal/privacidade.md?raw";
import { Markdown } from "@/components/Markdown";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Dental Hub" },
      {
        name: "description",
        content:
          "Como o Dental Hub coleta, usa e protege seus dados em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Dental Hub" },
      {
        property: "og:description",
        content: "Política de privacidade adaptada à LGPD.",
      },
    ],
  }),
});

function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade">
      <Markdown source={privacidadeMd} />
      <p className="mt-8 text-sm text-muted-foreground">
        Veja também:{" "}
        <Link to="/cookies" className="text-primary hover:underline">
          Política de Cookies
        </Link>{" "}
        e{" "}
        <Link to="/termos" className="text-primary hover:underline">
          Termos de Uso
        </Link>
        .
      </p>
    </LegalLayout>
  );
}
