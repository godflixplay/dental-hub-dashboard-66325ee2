import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, role } = useAuth();
  // Atrasa o spinner em 200ms para evitar flash em transições rápidas.
  // Quando a sessão já está em cache, o spinner nem aparece.
  const [showSpinner, setShowSpinner] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowSpinner(false);
      return;
    }
    const t = setTimeout(() => setShowSpinner(true), 200);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading) {
    if (!showSpinner) return null;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // Silencia warning de variável não usada — `role` continua disponível para
  // futuras checagens, mas não é necessário aqui.
  void role;

  return <Outlet />;
}
