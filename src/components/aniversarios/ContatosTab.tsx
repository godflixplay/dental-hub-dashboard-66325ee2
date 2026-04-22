import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Trash2, Search, Plus, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  getAniversariosErrorMessage,
  withRequestTimeout,
} from "@/components/aniversarios/request-utils";
import { normalizePhoneBR } from "@/components/aniversarios/phone-utils";
import {
  parsePlanilhaFile,
  type ParseResult,
} from "@/components/aniversarios/parse-planilha";

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  data_nascimento: string | null;
  instancia_id: string | null;
  created_at: string;
}

export function ContatosTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editContato, setEditContato] = useState<Contato | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", data_nascimento: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  // Estado de import com preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);

  const contatosQuery = useQuery({
    queryKey: ["aniv:contatos:full", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await withRequestTimeout(
        supabase.from("contatos").select("*").order("nome", { ascending: true }),
        "O carregamento dos contatos",
      );
      if (error) throw error;
      return (data as Contato[]) ?? [];
    },
  });

  const instanciaQuery = useQuery({
    queryKey: ["aniv:instance:id", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      return ((data as { id: string } | null)?.id) ?? null;
    },
  });

  const contatos = contatosQuery.data ?? [];
  const instanciaId = instanciaQuery.data ?? null;
  const loading = contatosQuery.isLoading;

  const refetchContatos = () =>
    queryClient.invalidateQueries({ queryKey: ["aniv:contatos:full", userId] });

  if (contatosQuery.isError) {
    // Mostra erro ao usuário sem quebrar a UI; o array vazio renderiza normalmente.
    console.warn("[ContatosTab] erro ao carregar", contatosQuery.error);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Valida extensão
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
      toast.error("Formato inválido. Use apenas CSV ou XLSX.");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      const result = await parsePlanilhaFile(file);
      if (result.total === 0) {
        toast.error("Planilha vazia.");
        return;
      }
      setPreviewData(result);
      setPreviewOpen(true);
    } catch (err) {
      console.error("[ContatosTab] erro ao ler arquivo", err);
      toast.error("Erro ao ler o arquivo. Verifique o formato.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleConfirmImport = async () => {
    if (!previewData || !user) return;
    if (previewData.validos.length === 0) {
      toast.error("Nenhuma linha válida para importar.");
      return;
    }
    setImporting(true);
    try {
      // Converte 10/11 dígitos → 55DDXXXXXXXXX (padrão Evolution API)
      const payload = previewData.validos.map((v) => {
        const norm = normalizePhoneBR(v.telefone);
        return {
          user_id: user.id,
          instancia_id: instanciaId,
          nome: v.nome,
          telefone: norm.valid ? norm.phone : v.telefone,
          data_nascimento: v.data_nascimento,
        };
      });

      // Insert em batch ignorando duplicados (UNIQUE user_id+telefone)
      const { data: inserted, error } = await supabase
        .from("contatos")
        .upsert(payload, {
          onConflict: "user_id,telefone",
          ignoreDuplicates: true,
        })
        .select("id");

      if (error) {
        toast.error("Erro ao importar: " + error.message);
        return;
      }

      const totalInserido = inserted?.length ?? 0;
      const totalIgnorado = payload.length - totalInserido;
      const totalErro = previewData.invalidos.length;

      toast.success(
        `Inseridos: ${totalInserido} • Ignorados (duplicados): ${totalIgnorado} • Com erro: ${totalErro}`,
      );

      setPreviewOpen(false);
      setPreviewData(null);
      await refetchContatos();
    } catch (err) {
      toast.error(getAniversariosErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };


  const handleSave = async () => {
    if (!user || !form.nome || !form.telefone) return;
    if (!form.data_nascimento) {
      toast.error("Data de nascimento é obrigatória.");
      return;
    }
    if (!instanciaId) {
      toast.error(
        "Conecte uma instância do WhatsApp antes de cadastrar contatos.",
      );
      return;
    }
    const norm = normalizePhoneBR(form.telefone);
    if (!norm.valid) {
      toast.error(
        norm.reason ??
          "Número inválido. Use formato 55DDXXXXXXXXX (ex: 5521981089100).",
      );
      return;
    }
    const payload = {
      nome: form.nome.trim(),
      telefone: norm.phone,
      data_nascimento: form.data_nascimento,
      instancia_id: instanciaId,
      user_id: user.id,
    };

    try {
      if (editContato) {
        const { error } = await supabase
          .from("contatos")
          .update(payload)
          .eq("id", editContato.id);
        if (error) throw error;
        toast.success("Contato atualizado");
        setEditContato(null);
      } else {
        const { error } = await supabase.from("contatos").insert(payload);
        if (error) throw error;
        toast.success("Contato adicionado");
        setAddOpen(false);
      }
      setForm({ nome: "", telefone: "", data_nascimento: "" });
      await refetchContatos();
    } catch (err) {
      toast.error(getAniversariosErrorMessage(err));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contatos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Contato removido");
      await refetchContatos();
    }
  };

  const openEdit = (c: Contato) => {
    setEditContato(c);
    setForm({
      nome: c.nome,
      telefone: c.telefone,
      data_nascimento: c.data_nascimento ?? "",
    });
  };

  const filtered = contatos.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.telefone.includes(search),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setForm({ nome: "", telefone: "", data_nascimento: "" });
              setAddOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Adicionar
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            {uploading ? "Importando..." : "Importar Planilha"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{contatos.length} contatos</Badge>
        {!instanciaId && (
          <Badge variant="destructive">
            Conecte o WhatsApp para vincular novos contatos a uma instância.
          </Badge>
        )}
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
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground py-8"
                  >
                    Nenhum contato cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell
                      className="font-medium cursor-pointer hover:underline"
                      onClick={() => openEdit(c)}
                    >
                      {c.nome}
                    </TableCell>
                    <TableCell>{c.telefone}</TableCell>
                    <TableCell>
                      {c.data_nascimento
                        ? new Date(c.data_nascimento + "T12:00:00").toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
        open={addOpen || !!editContato}
        onOpenChange={() => {
          setAddOpen(false);
          setEditContato(null);
          setForm({ nome: "", telefone: "", data_nascimento: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editContato ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
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
              <Label>Telefone (com DDD)</Label>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="5511999999999"
              />
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
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
