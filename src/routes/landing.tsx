import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/landing")({
  component: LandingPreview,
  head: () => ({
    meta: [
      {
        title: "Preview — DentalHub",
      },
      {
        name: "description",
        content:
          "Preview da página de vendas do DentalHub. Acesso direto, sem redirecionamento por autenticação.",
      },
      {
        name: "robots",
        content: "noindex,nofollow",
      },
    ],
  }),
});

function LandingPreview() {
  return <LandingPage />;
}
