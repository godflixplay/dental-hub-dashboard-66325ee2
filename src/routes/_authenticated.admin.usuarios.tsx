import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, MoreHorizontal } from "lucide-react";
import {
  Card,
  CardContent,
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

interface Profile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: AdminUsuarios,
});

function AdminUsuarios() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setProfiles(data ?? []);
    setLoading(false);
  };

  const filtered = profiles.filter(
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
          Gerencie os usuários da plataforma
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                    <TableCell className="font-medium">
                      {profile.email}
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
                      <Badge variant="outline">Desconectado</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Badge variant="outline">Gratuito</Badge>
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

      <Dialog
        open={!!selectedUser}
        onOpenChange={() => setSelectedUser(null)}
      >
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
                  <p className="text-muted-foreground">Data de Cadastro</p>
                  <p className="font-medium">
                    {formatDateBR(selectedUser.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Plano</p>
                  <Badge variant="outline">Gratuito</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">WhatsApp</p>
                  <Badge variant="outline">Desconectado</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Contatos</p>
                  <p className="font-medium">0</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">Serviços</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Aniversários</Badge>
                  <Badge variant="outline">Campanhas (em breve)</Badge>
                  <Badge variant="outline">Lembretes (em breve)</Badge>
                  <Badge variant="outline">Recuperação (em breve)</Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">
                  Ações Administrativas
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline">
                    Importar Contatos
                  </Button>
                  <Button size="sm" variant="outline">
                    Configurar WhatsApp
                  </Button>
                  <Button size="sm" variant="outline">
                    Alterar Plano
                  </Button>
                  <Button size="sm" variant="destructive">
                    Desativar Usuário
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
