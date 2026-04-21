

## Plano: estabilizar navegação e eliminar travas ao trocar de página

### O que está realmente acontecendo (diagnóstico)

Reproduzi o problema lendo o código e a tela travada que você mostrou. São **quatro causas independentes** somadas — por isso parece aleatório e demorado:

**1. Erro de chunk antigo após rebuild (causa principal do "spinner por minutos")**
O erro de runtime atual é:
```
Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry
```
Esse erro acontece quando o sandbox/preview faz hot reload (você editou algo, ou o dev server reiniciou) e o navegador ainda tem em cache uma referência a um chunk JS que não existe mais. O React tenta importar a próxima rota, falha, e como **não existe error boundary capturando esse caso**, a tela fica num spinner para sempre. Só sai disso recarregando a página manualmente. Isso não é problema de Supabase nem de Evolution — é uma quirk de SPAs com code-splitting que precisa ser tratada explicitamente.

**2. Loop de loading no `useAuth` ao remontar**
Em `src/hooks/use-auth.tsx`, toda vez que o `AuthProvider` monta (e ele está dentro de `__root.tsx`, então monta 1× só — mas o hook executa o efeito sempre que `applySession` muda), o `loading` começa como `true` e só vira `false` depois que `getSession()` retornar. Como `_authenticated.tsx` faz:
```ts
if (loading) return <Spinner />;
```
…qualquer atraso de rede do Supabase mostra o spinner global durante todo o intervalo. Pior: cada chamada a `applySession` dispara `fetchRole` (consulta `profiles`), e isso roda **a cada onAuthStateChange** (TOKEN_REFRESHED, SIGNED_IN, INITIAL_SESSION), causando refetches desnecessários.

**3. Refetch completo a cada montagem de aba (e abas remontam ao trocar de rota)**
`EnvioTab`, `WhatsAppTab`, `ContatosTab`, `MensagemTab` carregam tudo do zero no `useEffect` mount. Quando você sai da página `/dashboard/aniversarios` e volta, **todas as 4 abas remontam e fazem 4–10 requisições cada** (Supabase + Evolution). O timeout do Evolution é 25s. Se a Evolution estiver lenta, a aba fica em "loading" até 25s — isso é o que você descreve como "alguns minutos".

**4. Sem cache compartilhado / sem TanStack Query**
Não há `QueryClient` no projeto. Cada componente reimplementa fetch+loading+error manualmente, sem deduplicação, sem cache, sem stale-while-revalidate. É por isso que voltar para a tela é tão caro quanto entrar pela primeira vez.

---

### O que vou implementar

**A. Eliminar o "spinner para sempre" após rebuild**
Em `src/router.tsx`, adicionar handler global para erros de import dinâmico. Quando o Vite faz reload e o chunk some, recarregar a página automaticamente uma única vez (com guarda em sessionStorage para não criar loop):
```ts
window.addEventListener("vite:preloadError", () => {
  if (!sessionStorage.getItem("__reloaded_for_chunk")) {
    sessionStorage.setItem("__reloaded_for_chunk", "1");
    window.location.reload();
  }
});
```
Limpar o flag após carregar com sucesso. Isso mata o "trava por minutos" descrito.

**B. Estabilizar `useAuth` (sem loops, sem reset de loading)**
- `loading` só vira `true` na primeira chamada; `onAuthStateChange` posteriores não voltam a `loading=true`.
- `fetchRole` só é chamado quando o `userId` realmente muda (memoizar último id buscado).
- Não chamar `setRole(null)` durante refresh de token (mantém role atual até confirmar logout).

**C. Adicionar TanStack Query para cache persistente entre navegações**
- Instalar `@tanstack/react-query`.
- Criar `QueryClient` dentro de `getRouter()` em `src/router.tsx`, passar via context, prover em `__root.tsx`.
- Migrar as queries de carregamento (não as mutações nem envios) em:
  - `EnvioTab` → `useQuery` para contatos, instância, config, envios (chaves separadas por `user.id`).
  - `WhatsAppTab` → `useQuery` para a instância.
  - `ContatosTab` → `useQuery` para contatos + instância.
  - `MensagemTab` → `useQuery` para config.
- `staleTime: 30_000` para reduzir refetch ao remontar; `gcTime: 5min`.
- Sincronização de status Evolution permanece em background (fora do Query), mas só roda 1×/montagem real (não a cada toggle de aba).

**D. Reduzir custo do Evolution sync**
- Em `EnvioTab.fetchAll`, o background sync de status deixa de rodar toda vez que a aba "monta". Passa a rodar **no máximo a cada 60 segundos por usuário** (timestamp em ref/localStorage). Voltar para a aba dentro de 1 minuto não dispara nova chamada.
- Mantém o timeout existente de 25s, mas como roda em background não trava nada.

**E. Pequenas melhorias de UX**
- `_authenticated.tsx`: trocar o spinner global por `null` (silencioso) quando `loading` for transição rápida (<200ms) — usar `useState` + `setTimeout` para só mostrar spinner se passar de 200ms. Evita flash branco e reduz a sensação de "tudo travou".
- `__root.tsx`: adicionar `notFoundComponent` no router config também (já tem no root, mas deixar redundante para garantir).

---

### Arquivos que serão alterados

- `src/router.tsx` — handler `vite:preloadError`, criação do `QueryClient`, `defaultErrorComponent` melhorado.
- `src/routes/__root.tsx` — `QueryClientProvider` envolvendo o `Outlet`.
- `src/hooks/use-auth.tsx` — não resetar `loading` em events subsequentes; memoizar `fetchRole`.
- `src/routes/_authenticated.tsx` — spinner com delay de 200ms.
- `src/components/aniversarios/EnvioTab.tsx` — migrar para `useQuery`; throttle do sync Evolution.
- `src/components/aniversarios/WhatsAppTab.tsx` — migrar leitura inicial da instância para `useQuery`.
- `src/components/aniversarios/ContatosTab.tsx` — `useQuery` para contatos e instância.
- `src/components/aniversarios/MensagemTab.tsx` — `useQuery` para config.
- `package.json` — adicionar `@tanstack/react-query`.

Sem mudança de banco. Sem mudança de schema. Sem nova migração.

### Resultado esperado

- Trocar de aba ou de página retorna **instantaneamente** (cache de 30s).
- Spinner global aparece no máximo 200ms — se a sessão já existe, nem aparece.
- Erro de chunk após rebuild se autorrecupera com 1 reload silencioso (não trava mais).
- Sync de status Evolution acontece no máximo 1×/min, sempre em background.
- Sessão WhatsApp permanece (isso já funcionava — a "desconexão" percebida era na verdade o spinner travado).

### Validação

1. Login → `/dashboard` → `/dashboard/aniversarios` → `/dashboard` → `/dashboard/aniversarios`: segunda visita deve renderizar em <100ms.
2. Forçar erro de chunk (simulando rebuild): tela recupera sozinha.
3. Trocar entre abas WhatsApp/Mensagem/Contatos/Envio: dados persistidos, sem refetch visível.
4. Deixar a aba aberta 30 minutos, voltar: ainda funciona, sem "deslogar".

