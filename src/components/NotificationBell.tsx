import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listNotificacoes,
  marcarComoLida,
} from "@/utils/notificacoes.functions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTimeBR } from "@/lib/date-format";

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: "info" | "sucesso" | "aviso" | "erro";
  link: string | null;
  lida: boolean;
  audiencia: "cliente" | "admin";
  created_at: string;
}

const tipoStyle: Record<Notificacao["tipo"], string> = {
  info: "bg-primary/10 text-primary",
  sucesso: "bg-accent/10 text-accent",
  aviso: "bg-amber-500/10 text-amber-600",
  erro: "bg-destructive/10 text-destructive",
};

export function NotificationBell() {
  const { user, session } = useAuth();
  const accessToken = session?.access_token ?? "";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [marking, setMarking] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notificacoes"],
    enabled: !!accessToken,
    queryFn: () => listNotificacoes({ data: { accessToken } }),
    refetchInterval: 60_000,
  });

  const notificacoes = (data?.notificacoes ?? []) as Notificacao[];
  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  const handleMarkAll = useCallback(async () => {
    if (!accessToken || naoLidas === 0) return;
    setMarking(true);
    try {
      await marcarComoLida({ data: { accessToken } });
      await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
    } finally {
      setMarking(false);
    }
  }, [accessToken, naoLidas, queryClient]);

  const handleItemClick = useCallback(
    async (n: Notificacao) => {
      if (!n.lida && accessToken) {
        await marcarComoLida({ data: { accessToken, id: n.id } });
        await queryClient.invalidateQueries({ queryKey: ["notificacoes"] });
      }
      if (n.link) window.location.href = n.link;
    },
    [accessToken, queryClient],
  );

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
          <span className="sr-only">Notificações</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">
              {naoLidas} não {naoLidas === 1 ? "lida" : "lidas"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAll}
            disabled={marking || naoLidas === 0}
            className="gap-1 text-xs"
          >
            <CheckCheck className="h-3 w-3" />
            Marcar todas
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : notificacoes.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma notificação por aqui.
            </p>
          ) : (
            <ul className="divide-y">
              {notificacoes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleItemClick(n)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-muted",
                      !n.lida && "bg-primary/5",
                    )}
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-0.5 shrink-0 capitalize",
                        tipoStyle[n.tipo],
                      )}
                    >
                      {n.tipo}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {n.titulo}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {n.mensagem}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDateTimeBR(n.created_at)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
