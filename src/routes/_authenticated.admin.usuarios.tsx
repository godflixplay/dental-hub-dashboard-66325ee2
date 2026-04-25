import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminUsuarios } from "@/utils/admin.functions";
import { Search, User, MoreHorizontal, Loader2, Phone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBR } from "@/lib/date-format";

interface UsuarioRow {
  id: string;
  email: string;
  role: string;
  created_at: string;
  contatos: number;
  whatsapp_status: string;
  plano: string;
  nome_responsavel: string | null;
  nome_clinica: string | null;
  telefone_contato: string | null;
}

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

function formatPhoneBR(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13) {
    // 55 + DDD + numero
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  return raw;
}

function buildWaLink(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const e164 = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${e164}`;
}

function AdminUsuarios() {
  const { session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UsuarioRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-usuarios"],
    enabled: !!accessToken,
    queryFn: () => adminUsuarios({ data: { accessToken } }),
  });

  const usuarios = (data?.usuarios ?? []) as UsuarioRow[];
  const filtered = usuarios.filter((p) => {
    const term = search.toLowerCase();
    return (
      p.email.toLowerCase().includes(term) ||
      p.role.toLowerCase().includes(term) ||
      (p.nome_responsavel ?? "").toLowerCase().includes(term) ||
      (p.telefone_contato ?? "").includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Gestão de Usuários
        </h1>
        <p className="mt-1 text-muted-foreground">
          {usuarios.length} usuário(s) cadastrado(s)
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail, telefone ou role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responsável</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Contatos</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((profile) => {
                  const waLink = buildWaLink(profile.telefone_contato);
                  return (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="font-medium">
                          {profile.nome_responsavel ?? "—"}
                        </div>
                        {profile.nome_clinica && (
                          <div className="text-xs text-muted-foreground">
                            {profile.nome_clinica}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profile.email}
                      </TableCell>
                      <TableCell>
                        {waLink ? (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {formatPhoneBR(profile.telefone_contato)}
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            profile.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {profile.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateBR(profile.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            profile.whatsapp_status === "connected"
                              ? "default"
                              : "outline"
                          }
                        >
                          {profile.whatsapp_status === "connected"
                            ? "Conectado"
                            : "Desconectado"}
                        </Badge>
                      </TableCell>
                      <TableCell>{profile.contatos}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            profile.plano === "Gratuito" ? "outline" : "default"
                          }
                        >
                          {profile.plano}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedUser(profile)}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes do Usuário
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <p className="text-muted-foreground">Responsável</p>
                  <p className="font-medium">
                    {selectedUser.nome_responsavel ?? "—"}
                  </p>
                </div>
                {selectedUser.nome_clinica && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Clínica</p>
                    <p className="font-medium">{selectedUser.nome_clinica}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">E-mail</p>
                  <p className="font-medium break-all">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Telefone</p>
                  {(() => {
                    const wa = buildWaLink(selectedUser.telefone_contato);
                    return wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {formatPhoneBR(selectedUser.telefone_contato)}
                      </a>
                    ) : (
                      <p className="font-medium">—</p>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <Badge
                    variant={
                      selectedUser.role === "admin" ? "default" : "secondary"
                    }
                  >
                    {selectedUser.role}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Cadastro</p>
                  <p className="font-medium">
                    {formatDateBR(selectedUser.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plano</p>
                  <Badge
                    variant={
                      selectedUser.plano === "Gratuito" ? "outline" : "default"
                    }
                  >
                    {selectedUser.plano}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">WhatsApp Evolution</p>
                  <Badge
                    variant={
                      selectedUser.whatsapp_status === "connected"
                        ? "default"
                        : "outline"
                    }
                  >
                    {selectedUser.whatsapp_status === "connected"
                      ? "Conectado"
                      : "Desconectado"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Contatos</p>
                  <p className="font-medium">{selectedUser.contatos}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
