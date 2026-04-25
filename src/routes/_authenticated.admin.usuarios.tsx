import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { adminUsuarios } from "@/utils/admin.functions";
import { Search, User, MoreHorizontal, Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
}

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

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
  const filtered = usuarios.filter(
    (p) =>
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase()),
  );

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
          placeholder="Buscar por e-mail ou role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
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
                <TableHead>E-mail</TableHead>
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
                    colSpan={7}
                    className="text-center text-muted-foreground"
                  >
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
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
                ))
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
                <div>
                  <p className="text-muted-foreground">E-mail</p>
                  <p className="font-medium">{selectedUser.email}</p>
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
                  <p className="text-muted-foreground">WhatsApp</p>
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
