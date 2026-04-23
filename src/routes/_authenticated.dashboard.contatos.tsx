import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeft,
  Search,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { withRequestTimeout } from "@/components/aniversarios/request-utils";

const PAGE_SIZE = 50;

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string | null;
  ativo: boolean;
  created_at: string;
}

export const Route = createFileRoute("/_authenticated/dashboard/contatos")({
  component: MeusContatosPage,
});

function MeusContatosPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [tab, setTab] = useState<"ativos" | "removidos">("ativos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Contato | null>(null);
  const [form, setForm] = useState({ nome: "", data_nascimento: "" });

  const isAtivo = tab === "ativos";

  const queryKey = ["contatos:list", userId, isAtivo, search, page] as const;

  const contatosQuery = useQuery({
    queryKey,
    enabled: !!userId,
    queryFn: async () => {
      // Isolamento: SEMPRE filtra por user_id (defesa em profundidade além da RLS).
      let query = supabase
        .from("contatos")
        .select("id, nome, telefone, data_nascimento, ativo, created_at", {
          count: "exact",
        })
        .eq("user_id", userId!)
        .eq("ativo", isAtivo)
        .order("nome", { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      const term = search.trim();
      if (term) {
        // Escapa vírgulas e parênteses do termo para o filtro `or`
        const safe = term.replace(/[,()]/g, " ");
        query = query.or(`nome.ilike.%${safe}%,telefone.ilike.%${safe}%`);
      }

      const { data, error, count } = await withRequestTimeout(
        query,
        "O carregamento dos contatos",
      );
      if (error) throw error;
      return {
        rows: (data as Contato[]) ?? [],
        total: count ?? 0,
      };
    },
  });

  const rows = contatosQuery.data?.rows ?? [];
  const total = contatosQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["contatos:list", userId] });

  const handleSoftDelete = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("contatos")
      .update({ ativo: false })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
      return;
    }
    toast.success("Contato removido");
    await invalidate();
  };

  const handleRestore = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("contatos")
      .update({ ativo: true })
      .eq("id", id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao restaurar: " + error.message);
      return;
    }
    toast.success("Contato restaurado");
    await invalidate();
  };

  const openEdit = (c: Contato) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      data_nascimento: c.data_nascimento ?? "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editing || !userId) return;
    if (!form.nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const { error } = await supabase
      .from("contatos")
      .update({
        nome: form.nome.trim(),
        data_nascimento: form.data_nascimento || null,
      })
      .eq("id", editing.id)
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Contato atualizado");
    setEditing(null);
    await invalidate();
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
  };

  const onTabChange = (value: string) => {
    setTab(value === "removidos" ? "removidos" : "ativos");
    setPage(0);
  };

  const pageInfo = useMemo(() => {
    if (total === 0) return "0 contatos";
    const start = page * PAGE_SIZE + 1;
    const end = Math.min(total, (page + 1) * PAGE_SIZE);
    return `${start}–${end} de ${total}`;
  }, [page, total]);

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Meus Contatos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualize, edite e gerencie sua base de contatos.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="removidos">Removidos</TabsTrigger>
        </TabsList>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Badge variant="secondary">{pageInfo}</Badge>
        </div>

        <TabsContent value="ativos" className="mt-4">
          <ContatosTable
            rows={rows}
            loading={contatosQuery.isLoading}
            mode="ativos"
            onEdit={openEdit}
            onDelete={handleSoftDelete}
          />
        </TabsContent>

        <TabsContent value="removidos" className="mt-4">
          <ContatosTable
            rows={rows}
            loading={contatosQuery.isLoading}
            mode="removidos"
            onRestore={handleRestore}
          />
        </TabsContent>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || contatosQuery.isLoading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || contatosQuery.isLoading}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Tabs>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={editing?.telefone ?? ""} disabled />
              <p className="text-xs text-muted-foreground mt-1">
                Telefone não pode ser alterado.
              </p>
            </div>
            <div>
              <Label>Data de Nascimento</Label>
              <Input
                type="date"
                value={form.data_nascimento}
                onChange={(e) =>
                  setForm({ ...form, data_nascimento: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ContatosTableProps {
  rows: Contato[];
  loading: boolean;
  mode: "ativos" | "removidos";
  onEdit?: (c: Contato) => void;
  onDelete?: (id: string) => void;
  onRestore?: (id: string) => void;
}

function ContatosTable({
  rows,
  loading,
  mode,
  onEdit,
  onDelete,
  onRestore,
}: ContatosTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Nascimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-32 text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-8"
              >
                {mode === "ativos"
                  ? "Nenhum contato encontrado."
                  : "Nenhum contato removido."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.telefone}</TableCell>
                <TableCell>
                  {c.data_nascimento
                    ? new Date(
                        c.data_nascimento + "T12:00:00",
                      ).toLocaleDateString("pt-BR")
                    : "—"}
                </TableCell>
                <TableCell>
                  {c.ativo ? (
                    <Badge variant="secondary">Ativo</Badge>
                  ) : (
                    <Badge variant="outline">Removido</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {mode === "ativos" ? (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit?.(c)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete?.(c.id)}
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRestore?.(c.id)}
                      title="Restaurar contato"
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
