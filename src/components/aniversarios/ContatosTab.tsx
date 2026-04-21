import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Trash2, Search, Plus } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  getAniversariosErrorMessage,
  withRequestTimeout,
} from "@/components/aniversarios/request-utils";
import { normalizePhoneBR } from "@/components/aniversarios/phone-utils";

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
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editContato, setEditContato] = useState<Contato | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "", data_nascimento: "" });
  const [instanciaId, setInstanciaId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchContatos = async () => {
    setLoading(true);
    try {
      const { data, error } = await withRequestTimeout(
        supabase.from("contatos").select("*").order("nome", { ascending: true }),
        "O carregamento dos contatos",
      );
      if (error) throw error;
      setContatos((data as Contato[]) ?? []);
    } catch (error) {
      toast.error(getAniversariosErrorMessage(error));
      setContatos([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchInstancia = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    setInstanciaId((data as { id: string } | null)?.id ?? null);
  };

  useEffect(() => {
    fetchContatos();
    fetchInstancia();
  }, [user?.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
        raw: false,
      });

      let rejected = 0;
      const mapped = rows
        .map((row) => {
          const nome =
            row["nome"] || row["Nome"] || row["NOME"] || row["name"] || "";
          const telefone =
            row["telefone"] ||
            row["Telefone"] ||
            row["TELEFONE"] ||
            row["phone"] ||
            row["celular"] ||
            row["Celular"] ||
            "";
          const nascimento =
            row["data_nascimento"] ||
            row["Data Nascimento"] ||
            row["DATA_NASCIMENTO"] ||
            row["nascimento"] ||
            row["Nascimento"] ||
            row["aniversario"] ||
            row["Aniversario"] ||
            "";
          const norm = normalizePhoneBR(telefone.toString());
          return {
            user_id: user.id,
            instancia_id: instanciaId,
            nome: nome.trim(),
            telefone: norm.valid ? norm.phone : "",
            data_nascimento: parseDate(nascimento) || null,
            _valid: !!nome && norm.valid,
          };
        })
        .filter((c) => {
          if (!c._valid) {
            rejected += 1;
            return false;
          }
          return true;
        })
        .map(({ _valid, ...rest }) => rest);

      if (mapped.length === 0) {
        toast.error(
          rejected > 0
            ? `Nenhum contato válido. ${rejected} rejeitados (nome ausente ou número inválido).`
            : "Nenhum contato válido encontrado na planilha",
        );
        return;
      }

      const { error } = await supabase.from("contatos").insert(mapped);
      if (error) {
        toast.error("Erro ao importar: " + error.message);
      } else {
        toast.success(
          rejected > 0
            ? `${mapped.length} contatos importados, ${rejected} rejeitados por número inválido.`
            : `${mapped.length} contatos importados!`,
        );
        fetchContatos();
      }
    } catch {
      toast.error("Erro ao ler o arquivo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const parseDate = (value: string): string | null => {
    if (!value) return null;
    // Try DD/MM/YYYY
    const brMatch = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (brMatch) {
      const [, d, m, y] = brMatch;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Try YYYY-MM-DD
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    // Try Excel serial number
    const num = Number(value);
    if (!isNaN(num) && num > 1000 && num < 100000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      return date.toISOString().split("T")[0];
    }
    return null;
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

    if (editContato) {
      const { error } = await supabase
        .from("contatos")
        .update(payload)
        .eq("id", editContato.id);
      if (error) toast.error(error.message);
      else {
        toast.success("Contato atualizado");
        setEditContato(null);
      }
    } else {
      const { error } = await supabase.from("contatos").insert(payload);
      if (error) toast.error(error.message);
      else {
        toast.success("Contato adicionado");
        setAddOpen(false);
      }
    }
    setForm({ nome: "", telefone: "", data_nascimento: "" });
    fetchContatos();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("contatos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Contato removido");
      fetchContatos();
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

      <Badge variant="secondary">{contatos.length} contatos</Badge>

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

      {/* Add / Edit Dialog */}
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
