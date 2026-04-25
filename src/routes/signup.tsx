import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [nomeClinica, setNomeClinica] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nomeResponsavel.trim()) {
      setError("Informe o nome do responsável.");
      return;
    }

    const telefoneLimpo = telefoneContato.replace(/\D/g, "");
    if (telefoneLimpo.length < 10 || telefoneLimpo.length > 13) {
      setError("Informe um telefone/WhatsApp de contato válido (com DDD).");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          nome_responsavel: nomeResponsavel.trim(),
          nome_clinica: nomeClinica.trim() || null,
          telefone_contato: telefoneLimpo,
        },
      },
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      setSuccess(true);
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Verifique seu e-mail</CardTitle>
            <CardDescription>
              Enviamos um link de confirmação para <strong>{email}</strong>. Verifique sua caixa de entrada para ativar sua conta.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Voltar ao login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            DH
          </div>
          <h1 className="text-2xl font-bold text-foreground">Criar conta</h1>
          <p className="mt-1 text-sm text-muted-foreground">Comece a usar o Dental Hub</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cadastro</CardTitle>
            <CardDescription>Preencha os dados para criar sua conta</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="nomeResponsavel">Nome do responsável *</Label>
                <Input
                  id="nomeResponsavel"
                  type="text"
                  placeholder="Ex: João Silva"
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nomeClinica">Nome da clínica (opcional)</Label>
                <Input
                  id="nomeClinica"
                  type="text"
                  placeholder="Ex: Clínica Sorriso"
                  value={nomeClinica}
                  onChange={(e) => setNomeClinica(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefoneContato">WhatsApp / Telefone de contato *</Label>
                <Input
                  id="telefoneContato"
                  type="tel"
                  inputMode="tel"
                  placeholder="(11) 99999-0000"
                  value={telefoneContato}
                  onChange={(e) => setTelefoneContato(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Usado para te enviarmos avisos importantes da plataforma. Pode
                  ser o mesmo número da Evolution API ou um separado — você
                  configura a Evolution depois, na aba WhatsApp.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Criando conta..." : "Criar conta"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Entrar
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
