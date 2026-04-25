import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MessageCircle } from "lucide-react";

const SUPPORT_EMAIL = "contato@dentalhub.com.br";
const SUPPORT_WHATSAPP_LINK = "https://wa.me/5521981089100";

interface LegalLayoutProps {
  title: string;
  children: ReactNode;
}

export function LegalLayout({ title, children }: LegalLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header simples */}
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
              DH
            </div>
            <span className="font-bold text-foreground">Dental Hub</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <h1 className="mb-6 text-3xl font-bold text-foreground">{title}</h1>
        <div className="rounded-lg border bg-card p-5 sm:p-8 shadow-sm">
          {children}
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="mt-12 border-t bg-card">
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-foreground">Dental Hub</p>
            <p className="mt-1 text-xs">
              Automações de WhatsApp para clínicas odontológicas.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground">Suporte</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-2 hover:text-primary"
            >
              <Mail className="h-3.5 w-3.5" />
              {SUPPORT_EMAIL}
            </a>
            <a
              href={SUPPORT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              (21) 98108-9100
            </a>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-xs">
          <Link to="/privacidade" className="hover:text-primary">
            Privacidade
          </Link>
          <Link to="/cookies" className="hover:text-primary">
            Cookies
          </Link>
          <Link to="/termos" className="hover:text-primary">
            Termos de uso
          </Link>
          <Link to="/faq" className="hover:text-primary">
            FAQ
          </Link>
        </div>
      </div>
    </footer>
  );
}
