import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { LandingPage } from "@/components/landing/LandingPage";

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
