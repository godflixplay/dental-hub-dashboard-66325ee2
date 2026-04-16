

# Dental Hub — Plano de Implementação

## Visão Geral
SaaS modular para automações de WhatsApp voltado a clínicas odontológicas. Nesta fase: autenticação, dashboard com cards de serviços, e navegação entre módulos.

## 1. Autenticação (Supabase Auth)
- Páginas de **login**, **cadastro** e **recuperação de senha**
- Página `/reset-password` para definir nova senha
- Guard de rota (`_authenticated`) protegendo todo o `/dashboard`
- Redirecionamento automático: não logado → login, logado → dashboard

## 2. Banco de Dados (Supabase)
- **profiles** — id (FK auth.users), email, created_at
- **servicos** — id, nome, descricao, icone, status (`ativo` | `em_breve`), slug
- **usuario_servicos** — usuario_id (FK profiles), servico_id (FK servicos)
- RLS: usuários leem apenas seus próprios dados
- Seed inicial com 4 serviços: Aniversários (ativo), Campanhas, Lembretes, Recuperação (em breve)

## 3. Dashboard Principal (`/dashboard`)
- Layout com sidebar (logo, menu, logout)
- Grid de cards mostrando todos os serviços
- Cards ativos: clicáveis, com ícone colorido e botão "Acessar"
- Cards "em breve": visual esmaecido com badge "Em Breve", não clicáveis
- Boas-vindas com nome/email do usuário

## 4. Páginas de Serviços
- `/dashboard/aniversarios` — página funcional (estrutura base com título, descrição e espaço para futuro conteúdo)
- `/dashboard/campanhas` — placeholder "Em Breve"
- `/dashboard/lembretes` — placeholder "Em Breve"  
- `/dashboard/recuperacao` — placeholder "Em Breve"
- Cada página com botão de voltar ao dashboard

## 5. Design
- Interface limpa, SaaS moderno, tons de azul/branco
- Responsivo (mobile-first)
- Componentes shadcn/ui (cards, buttons, badges, sidebar)
- Ícones Lucide (Cake, Megaphone, Bell, UserCheck)

## 6. Rotas
```
/login
/signup
/forgot-password
/reset-password
/dashboard              (cards de serviços)
/dashboard/aniversarios
/dashboard/campanhas
/dashboard/lembretes
/dashboard/recuperacao
```

