import { createFileRoute } from "@tanstack/react-router";
import faqMd from "@/content/legal/faq.md?raw";
import { Markdown } from "@/components/Markdown";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/faq")({
  component: FAQPage,
  head: () => ({
    meta: [
      { title: "Perguntas Frequentes — Dental Hub" },
      {
        name: "description",
        content:
          "Tire suas dúvidas sobre o Dental Hub: como funciona, planos, WhatsApp e suporte.",
      },
      { property: "og:title", content: "FAQ — Dental Hub" },
      {
        property: "og:description",
        content: "Respostas para as dúvidas mais comuns dos dentistas.",
      },
    ],
  }),
});

function FAQPage() {
  return (
    <LegalLayout title="Perguntas Frequentes">
      <Markdown source={faqMd} />
    </LegalLayout>
  );
}
