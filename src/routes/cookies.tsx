import { createFileRoute, Link } from "@tanstack/react-router";
import cookiesMd from "@/content/legal/cookies.md?raw";
import { Markdown } from "@/components/Markdown";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/cookies")({
  component: CookiesPage,
  head: () => ({
    meta: [
      { title: "Política de Cookies — Dental Hub" },
      {
        name: "description",
        content:
          "Como o Dental Hub usa cookies para autenticação, análise e melhoria do serviço.",
      },
      { property: "og:title", content: "Política de Cookies — Dental Hub" },
      {
        property: "og:description",
        content: "Política de cookies adaptada à LGPD e Marco Civil.",
      },
    ],
  }),
});

function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies">
      <Markdown source={cookiesMd} />
      <p className="mt-8 text-sm text-muted-foreground">
        Voltar à{" "}
        <Link to="/privacidade" className="text-primary hover:underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </LegalLayout>
  );
}
