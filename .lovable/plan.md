

## Análise do estado atual

Já existe parte da infraestrutura implementada:
- ✅ Tabela `contatos` (com `user_id`, `nome`, `telefone`, `data_nascimento`)
- ✅ Tabela `whatsapp_instances` (com `user_id`, `instance_name`, `status`)
- ✅ Server functions Evolution API (`createInstance`, `getQrCode`, `getInstanceStatus`, `sendTextMessage`)
- ✅ Aba **Contatos** com upload CSV/XLSX
- ✅ Aba **WhatsApp** com criação de instância e QR Code
- ✅ Aba **Envio** (teste manual)
- ✅ RLS isolando dados por `user_id`

O que falta para atender o pedido:
1. Tabela `config_mensagem` (mensagem + imagem por usuário)
2. Tabela `envios` (log de envios)
3. Bucket de Storage para as imagens
4. Nova aba **Mensagem** com editor de texto + upload de imagem + preview
5. Atualizar aba **Envio** para usar a mensagem/imagem salva em `config_mensagem` e gravar log em `envios`

Observação importante: a estrutura atual usa nomes em inglês (`user_id`, `data_nascimento`, `whatsapp_instances`). Vou **manter esses nomes** para não quebrar o que já funciona — apenas adicionando as duas novas tabelas (`config_mensagem` e `envios`) seguindo o mesmo padrão (`user_id`).

## Plano de implementação

### Etapa 1 — Banco de dados (migration)

Criar via migration:

**Tabela `config_mensagem`**
- `id uuid pk`
- `user_id uuid` (unique — uma config por usuário)
- `mensagem text` (suporta `{nome}`)
- `imagem_url text` (URL pública do Storage)
- `updated_at timestamptz`
- RLS: usuário só vê/edita a própria; admin vê todas

**Tabela `envios`**
- `id uuid pk`
- `user_id uuid`
- `contato_id uuid` (opcional, FK para `contatos`)
- `telefone text`
- `nome text`
- `status text` (`enviado` | `erro` | `pendente`)
- `erro text` (mensagem de erro quando aplicável)
- `data_envio timestamptz default now()`
- RLS: usuário só vê os próprios envios; admin vê todos

**Storage bucket `mensagens`** (público para leitura) com policies para upload/update/delete restritos ao próprio usuário (path `{user_id}/...`).

### Etapa 2 — Aba "Mensagem" (nova)

Criar `src/components/aniversarios/MensagemTab.tsx`:
- Textarea para mensagem com hint da variável `{nome}`
- Upload de imagem (input file → Supabase Storage bucket `mensagens` em `{user_id}/banner.{ext}`)
- Preview lado a lado: card simulando WhatsApp mostrando imagem + texto com `{nome}` substituído por "João" como exemplo
- Botão **Salvar** → upsert em `config_mensagem`
- Carrega config existente ao abrir

Adicionar a aba em `src/routes/_authenticated.dashboard.aniversarios.tsx` (ícone `MessageSquare`).

### Etapa 3 — Importação de contatos

Já implementado e funcional. **Sem mudanças** — apenas confirmar que aceita as colunas `Nome`, `Telefone`, `Data Nascimento` (já aceita variantes).

### Etapa 4 — Conexão WhatsApp

Já implementado. **Sem mudanças**.

### Etapa 5 — Atualizar aba "Envio"

Refatorar `EnvioTab.tsx`:
- Remover textarea manual de mensagem
- Carregar mensagem/imagem da `config_mensagem` do usuário
- Mostrar aviso se config não existir ("Configure sua mensagem na aba Mensagem")
- Ao enviar: substituir `{nome}`, chamar `sendTextMessage`, e gravar registro em `envios` (status `enviado` ou `erro`)
- (Opcional nesta etapa) Mostrar últimos envios em uma tabela abaixo

### Etapa 6 — Painel admin

A tabela `envios` aparecerá automaticamente para o admin via RLS quando expandirmos os relatórios. Nesta etapa apenas garantir as policies — UI admin de envios fica para depois.

## Estrutura final de arquivos

```text
src/
├── routes/_authenticated.dashboard.aniversarios.tsx   (+ aba Mensagem)
├── components/aniversarios/
│   ├── ContatosTab.tsx       (sem mudança)
│   ├── WhatsAppTab.tsx       (sem mudança)
│   ├── MensagemTab.tsx       (NOVO)
│   └── EnvioTab.tsx          (refatorado para usar config_mensagem + log envios)
└── integrations/supabase/    (tipos regenerados após migration)
```

## Fluxo de teste após implementação

1. Cadastrar/logar como cliente
2. Aba **WhatsApp** → criar instância → escanear QR
3. Aba **Mensagem** → escrever texto com `{nome}` + upload de imagem → salvar
4. Aba **Contatos** → importar planilha
5. Aba **Envio** → escolher contato → enviar (usa mensagem/imagem salva) → conferir registro em `envios`

## Pontos técnicos

- Migration adiciona `config_mensagem`, `envios` e bucket `mensagens` com RLS completa
- Storage path padronizado em `{user_id}/...` para policies funcionarem
- `EnvioTab` passa a inserir em `envios` após cada tentativa (sucesso ou erro)
- Envio com imagem usaria endpoint `sendMedia` da Evolution — nesta etapa, mantemos `sendText` e a imagem fica apenas no preview/config (envio com mídia entra na próxima iteração junto com a automação n8n, conforme você indicou)
- Isolamento total garantido via `user_id` + RLS em todas as tabelas

