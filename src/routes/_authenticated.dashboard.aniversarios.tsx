import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Users, Smartphone, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContatosTab } from "@/components/aniversarios/ContatosTab";
import { WhatsAppTab } from "@/components/aniversarios/WhatsAppTab";
import { MensagemTab } from "@/components/aniversarios/MensagemTab";
import { EnvioTab } from "@/components/aniversarios/EnvioTab";
import { AcessoBloqueadoBanner } from "@/components/aniversarios/AcessoBloqueadoBanner";
import { useAcessoAtivo } from "@/hooks/use-acesso-ativo";

export const Route = createFileRoute("/_authenticated/dashboard/aniversarios")({
  component: AniversariosPage,
});

function AniversariosPage() {
  const acesso = useAcessoAtivo();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Aniversários</h1>
          <p className="text-sm text-muted-foreground">
            Mensagens automáticas de aniversário via WhatsApp
          </p>
        </div>
      </div>

      <AcessoBloqueadoBanner
        acesso={acesso}
        acao="O envio automático de mensagens"
      />

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp">
            <Smartphone className="mr-2 h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="mensagem">
            <MessageSquare className="mr-2 h-4 w-4" />
            Mensagem
          </TabsTrigger>
          <TabsTrigger value="contatos">
            <Users className="mr-2 h-4 w-4" />
            Contatos
          </TabsTrigger>
          <TabsTrigger value="envio">
            <Send className="mr-2 h-4 w-4" />
            Envio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp">
          <WhatsAppTab acessoAtivo={acesso.ativo} />
        </TabsContent>

        <TabsContent value="mensagem">
          <MensagemTab acessoAtivo={acesso.ativo} />
        </TabsContent>

        <TabsContent value="contatos">
          <ContatosTab acessoAtivo={acesso.ativo} />
        </TabsContent>

        <TabsContent value="envio">
          <EnvioTab acessoAtivo={acesso.ativo} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
