

## Adicionar `invalidateQueries` ao fluxo pós-envio + verificar persistência de `user_id`

### Contexto
O fluxo atual em `EnvioTab.tsx` já faz quase tudo que você pediu:
- ✅ Refetch com `.eq("user_id", user.id)` + `.order("created_at", { ascending: false })` + `.limit(20)`
- ✅ Loop de retry com 6 tentativas × 1500ms procurando por `id` novo
- ✅ Filtro Realtime por `user_id`
- ✅ `user_id: user.id` é enviado no payload do webhook (linha 154 de `n8n-webhook.functions.ts`)

O que falta: **chamar `queryClient.invalidateQueries(["aniv:envios", user.id])`** explicitamente antes do retry, conforme solicitado, para garantir que qualquer outra leitura em cache também seja marcada como stale.

### Mudanças

**Arquivo: `src/components/aniversarios/EnvioTab.tsx`**

No bloco `handleSend` (em torno da linha 418, logo após `toast.success(...)` e antes do bloco `try { ... reloadEnvios() ... }`):

1. Adicionar uma chamada explícita:
   ```ts
   await queryClient.invalidateQueries({ queryKey: ["aniv:envios", user.id] });
   ```
   Isso marca a query como stale e dispara um refetch automático em paralelo ao loop manual — o que ainda chegar primeiro (Realtime, invalidate ou retry) atualiza a UI.

2. Manter o loop de retry existente (já implementa exatamente o pseudocódigo solicitado).

3. Manter `setQueryData` dentro do `reloadEnvios()` para também atualizar a UI imediatamente sem esperar o refetch disparado pelo invalidate.

### Verificação de `user_id` no Supabase

Não é necessário mudar código aqui — o `user_id` já é enviado no payload (linha 154 de `n8n-webhook.functions.ts`). O que **precisa ser conferido no n8n** (fora do código):

- O workflow do n8n deve usar o campo `user_id` recebido no body do webhook ao inserir em `envios_whatsapp`.
- A coluna `envios_whatsapp.user_id` deve estar com `NOT NULL` e com policy RLS permitindo insert via service_role (n8n) ou via JWT do usuário.

Se após o deploy o registro ainda não aparecer, o ajuste necessário é no fluxo do n8n, não no Lovable.

### Resultado esperado

- Após clicar em "Enviar Teste":
  1. Webhook é acionado.
  2. `invalidateQueries` marca a lista como stale e dispara refetch.
  3. Loop de retry busca diretamente do Supabase a cada 1.5s (até 6×).
  4. Realtime também escuta INSERT/UPDATE em paralelo.
- O primeiro dos três caminhos a encontrar o novo registro atualiza a UI — tipicamente em ~2s, sem refresh manual.

### Arquivos editados
- `src/components/aniversarios/EnvioTab.tsx` (1 linha adicionada no `handleSend`)

