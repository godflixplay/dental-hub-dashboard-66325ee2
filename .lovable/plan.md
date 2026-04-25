
# Plano: Landing pública + Admin operacional + Asaas (sandbox)

Trabalho dividido em 3 frentes independentes. Posso implementar todas em sequência no mesmo turno após sua aprovação.

---

## 1. Tornar a landing page acessível

### Problema atual
Em `src/routes/index.tsx`, o componente `Index` redireciona qualquer usuário logado para `/dashboard`. Como você está logado como `wnogueira@hotmail.com`, nunca vê a landing.

### Mudança
Criar uma rota dedicada **`/landing`** (arquivo `src/routes/landing.tsx`) que renderiza o mesmo `LandingPage` **sem checar autenticação**. Assim:

- `/` continua com o comportamento atual (redireciona logados → dashboard, mostra landing para visitantes).
- `/landing` sempre mostra a página de vendas, mesmo logado — útil para preview/edição.

### Arquivos
- ✏️ Refatorar `src/routes/index.tsx` extraindo `LandingPage` (e seus subcomponentes) para `src/components/landing/LandingPage.tsx`.
- 🆕 `src/routes/landing.tsx` — importa e renderiza `<LandingPage />` direto, com `head()` próprio.
- ✏️ `src/routes/index.tsx` passa a importar de `@/components/landing/LandingPage`.

---

## 2. Dashboard administrativo real

### Confirmação de acesso
Você confirmou que rodou o SQL anterior. Vou assumir que `wnogueira@hotmail.com` já está com `role = 'admin'` na tabela `profiles`. Caso ainda não esteja, basta rodar:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'wnogueira@hotmail.com';
```

### Estado atual
- `/admin` existe (`_authenticated.admin.tsx`) com sidebar e proteção por `role`.
- Sub-rotas: `/admin` (dashboard), `/admin/usuarios`, `/admin/logs`, `/admin/financeiro` — todas com **dados placeholder (`—`)**.

### Mudanças no dashboard `/admin/`
Substituir os placeholders por queries reais ao Supabase, agregando:

| Card | Query |
|---|---|
| Total de Usuários | `count(*) from profiles` |
| Usuários Ativos (últimos 30d) | `count(*) from profiles where last_sign_in_at > now() - interval '30 days'` (se disponível) ou via `auth.users` |
| WhatsApp Conectado | `count(*) from whatsapp_instances where status = 'connected'` |
| Contatos Cadastrados | `count(*) from contatos` |
| Mensagens Enviadas (mês) | `count(*) from envios_whatsapp where created_at > date_trunc('month', now())` |
| Taxa de Sucesso | `% de status='enviado' sobre total do mês` |
| MRR Atual | `sum(valor) from assinaturas where status='ativa' and ciclo='mensal'` (após Asaas configurado) |
| Assinaturas Ativas | `count(*) from assinaturas where status='ativa'` |

Implementação: criar `src/utils/admin.functions.ts` com server functions para cada métrica (evita expor queries no client e centraliza). Usar React Query no componente para cache.

### Mudanças em `/admin/logs`
Tabela real lendo `envios_whatsapp` (todos usuários, paginado) com colunas: data, usuário (email via join), telefone, status, erro. Filtros por status e período.

### Mudanças em `/admin/usuarios`
Já lista profiles. Vou:
- Adicionar contadores por linha: contatos, instâncias WhatsApp, status da assinatura.
- O dialog de detalhes já existe — vou conectar os botões "Desativar" e "WhatsApp" a ações reais (server functions).

### Arquivos
- 🆕 `src/utils/admin.functions.ts` — métricas agregadas + ações de usuário
- ✏️ `src/routes/_authenticated.admin.index.tsx` — usar dados reais
- ✏️ `src/routes/_authenticated.admin.logs.tsx` — tabela com dados reais
- ✏️ `src/routes/_authenticated.admin.usuarios.tsx` — enriquecer linhas + ações funcionais

---

## 3. Sistema de cobrança com Asaas (sandbox)

### Planos definidos
| Plano | Valor | Ciclo | Asaas billingType padrão |
|---|---|---|---|
| Mensal | **R$ 47,00** | recorrente mensal | PIX/BOLETO/CREDIT_CARD |
| Anual | **R$ 397,00** | recorrente anual (economia ~30%) | PIX/BOLETO/CREDIT_CARD |

### O que vou precisar de você
1. ✅ **Chave da API Asaas (sandbox)** — você confirmou que tem. Vou solicitar via tool de secret depois que a infra estiver pronta. Nome: `ASAAS_API_KEY`.
2. ✅ **Ambiente** — vou hardcodar `ASAAS_ENV=sandbox` por enquanto; quando for para produção, trocamos por secret.
3. ⚠️ **Token de webhook** — gerado por você no painel do Asaas (Configurações → Integrações → Webhooks). Nome do secret: `ASAAS_WEBHOOK_TOKEN`.

URL do webhook que você vai colar no Asaas:
```
https://project--92aab4bb-db62-4ff6-97c2-11b18c2546c1.lovable.app/api/public/asaas-webhook
```

### Schema do banco (migration nova)
```sql
-- Planos disponíveis
create table planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,            -- "Mensal" / "Anual"
  slug text unique not null,     -- "mensal" / "anual"
  valor numeric(10,2) not null,  -- 47.00 / 397.00
  ciclo text not null,           -- "mensal" / "anual"
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Assinatura do usuário
create table assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  plano_id uuid references planos(id) not null,
  asaas_customer_id text,        -- cus_xxx
  asaas_subscription_id text,    -- sub_xxx
  status text not null,          -- "trial" / "ativa" / "atrasada" / "cancelada"
  trial_ate timestamptz,
  proxima_cobranca timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Histórico de pagamentos (alimentado pelo webhook)
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid references assinaturas(id) on delete cascade,
  user_id uuid references auth.users(id) not null,
  asaas_payment_id text unique not null,
  valor numeric(10,2) not null,
  status text not null,          -- PENDING / RECEIVED / OVERDUE / REFUNDED
  billing_type text,             -- PIX / BOLETO / CREDIT_CARD
  data_vencimento date,
  data_pagamento timestamptz,
  invoice_url text,
  created_at timestamptz default now()
);
```
RLS: usuário vê só os próprios registros; admin vê todos. Seed dos dois planos no fim da migration.

### Server functions (`src/utils/asaas.functions.ts`)
- `criarCustomerAsaas(userId)` — cria/recupera customer no Asaas
- `criarAssinatura({ planoSlug, billingType })` — cria subscription no Asaas + linha em `assinaturas`
- `cancelarAssinatura(assinaturaId)`
- `obterFaturas(assinaturaId)` — lista pagamentos do usuário
- `getMinhaAssinatura()` — leitura para a UI

### Webhook público
- 🆕 `src/routes/api.public.asaas-webhook.ts` — valida `asaas-access-token` no header contra `ASAAS_WEBHOOK_TOKEN`, processa eventos `PAYMENT_*` e atualiza `pagamentos` + `assinaturas.status`.

### UI
- 🆕 `src/routes/_authenticated.dashboard.assinatura.tsx` — página "Minha Assinatura": plano atual, próxima cobrança, histórico de faturas (com link para boleto/PIX), botão de troca de plano e cancelamento.
- 🆕 `src/routes/_authenticated.dashboard.assinatura.checkout.tsx` — fluxo de escolha de plano + método de pagamento (sandbox).
- ✏️ Atualizar landing (`/landing`) com seção de **preços reais**: cards de R$47/mês e R$397/ano (economia destacada).
- ✏️ Sidebar do dashboard: novo item "Assinatura".

### Bloqueio por inadimplência (próxima fase, não nesse turno)
Estrutura preparada: campo `assinaturas.status='atrasada'` permite middleware futuro bloquear envios. Vou deixar o gancho pronto mas **sem ativar o bloqueio agora** — você decide a regra (5 dias, 7 dias?) depois de testar o fluxo.

### Arquivos da frente Asaas
- 🆕 Migration SQL (planos, assinaturas, pagamentos + RLS + seed)
- 🆕 `src/utils/asaas.functions.ts`
- 🆕 `src/routes/api.public.asaas-webhook.ts`
- 🆕 `src/routes/_authenticated.dashboard.assinatura.tsx`
- 🆕 `src/routes/_authenticated.dashboard.assinatura.checkout.tsx`
- ✏️ `src/components/DashboardSidebar.tsx`
- ✏️ `src/components/landing/LandingPage.tsx` (seção pricing)

---

## Ordem de execução proposta

1. **Frente 1 (landing)** — rápido, libera preview imediato.
2. **Frente 3 schema** (migration Asaas) — aplicada antes do código que depende dela.
3. **Frente 3 código** (functions + webhook + UI assinatura + pricing na landing).
4. **Frente 2 (admin real)** — depois que existir tabela `assinaturas`, o card de MRR já funciona.

Após você aprovar, vou:
1. Pedir os 2 secrets (`ASAAS_API_KEY` + `ASAAS_WEBHOOK_TOKEN`) na hora certa do fluxo.
2. Te entregar a URL do webhook para colar no painel Asaas.
3. Te passar o SQL da migration nova para rodar.
