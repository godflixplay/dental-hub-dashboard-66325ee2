---
name: Evolution API + Aniversários
description: WhatsApp via Evolution API, fluxo aniversários (config_mensagem, envios, storage mensagens)
type: feature
---

## Tabelas (Supabase externo)
- `contatos` (user_id, nome, telefone, data_nascimento)
- `whatsapp_instances` (user_id, instance_name, instance_id, status)
- `config_mensagem` (user_id UNIQUE, mensagem, imagem_url, updated_at)
- `envios` (user_id, contato_id, telefone, nome, status: enviado|erro|pendente, erro, data_envio)

## Storage
- Bucket público `mensagens` — upload restrito ao path `{user_id}/...` via RLS

## Server functions (`src/utils/evolution.functions.ts`)
- `createInstance`, `getQrCode`, `getInstanceStatus`, `sendTextMessage`
- Usam env vars `EVOLUTION_API_URL` e `EVOLUTION_API_KEY`

## Componentes (`src/components/aniversarios/`)
- `WhatsAppTab` — cria instância, exibe QR, checa status
- `MensagemTab` — texto com {nome}, upload imagem, preview WhatsApp, upsert config_mensagem
- `ContatosTab` — CRUD + import CSV/XLSX (xlsx)
- `EnvioTab` — usa config_mensagem, envia via sendTextMessage, grava log em envios, mostra histórico

## Isolamento
RLS por `user_id` em todas as tabelas; admin (profiles.role='admin') vê tudo.

## Próximos passos
- Envio com mídia (sendMedia da Evolution) usando imagem da config
- Automação diária via n8n para envio automático de aniversariantes
