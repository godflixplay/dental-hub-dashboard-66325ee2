

## Plano: Fluxo de conexão do WhatsApp inteligente e sem loops

### Objetivo
Tornar a aba WhatsApp determinística: ao abrir, decidir automaticamente entre "já conectado", "precisa de QR" ou "precisa criar instância" — sem nunca recriar instância existente e sem loading infinito.

### Comportamento alvo

```text
Abrir aba WhatsApp
        │
        ▼
[1] SELECT whatsapp_instances WHERE user_id = me
        │
   ┌────┴─────┐
   │          │
 não existe   existe
   │          │
   │          ▼
   │   [2] getInstanceStatus(instance_name)
   │          │
   │     ┌────┴─────────────────┐
   │     │                      │
   │   state=open         state≠open
   │     │                      │
   │     ▼                      ▼
   │  marca "connected"    [3] getQrCode(instance_name)
   │  no banco                  │ exibe QR + inicia polling
   │  libera Envio              │ a cada 5s checa status
   │                            │ → quando open: marca conectado
   ▼
[botão "Conectar WhatsApp"] → createInstance → fluxo segue para [2]
```

Regra de ouro: **createInstance só roda quando NÃO existe linha em `whatsapp_instances` para o usuário**. Se existir, reutiliza o `instance_name` salvo.

### Mudanças por arquivo

**`src/components/aniversarios/WhatsAppTab.tsx`** (refatoração principal)

1. Substituir `fetchInstance` por `bootstrapConnection`:
   - Busca linha em `whatsapp_instances` (com `withRequestTimeout`).
   - Se existe: chama `getInstanceStatus`. Se `state === "open"` → atualiza banco para `connected`, marca steps `create/save/qr/scan/connected` como `done`, libera UI conectada. Se não → chama `getQrCode` direto (pula `createInstance`) e exibe QR.
   - Se não existe: apenas finaliza loading e mostra botão "Conectar WhatsApp".
   - `finally` sempre limpa `loading` e `connecting` (garante zero loop).

2. `handleConnect` passa a ser usado **só para criar instância nova** (quando `instance` é null). Após criar, delega para `bootstrapConnection` para seguir o mesmo fluxo de status/QR — elimina caminho duplicado.

3. Adicionar **polling de status** enquanto QR estiver visível:
   - `useEffect` dispara `setInterval` de 5s chamando `getInstanceStatus` quando `qrCode && instance.status !== "connected"`.
   - Quando detectar `open`: limpa intervalo, atualiza banco, esconde QR, marca steps `scan/connected` como `done`, mostra toast de sucesso.
   - Cleanup do intervalo no unmount e quando `qrCode` virar null.
   - Limite de segurança: para o polling após 2 minutos para não rodar indefinidamente, mostrando aviso "Tempo esgotado, clique em Atualizar Status".

4. Estados finais sempre claros:
   - `loading` (spinner inicial) → vira `false` em todo caminho do `bootstrapConnection`.
   - `connecting` (botão de criar) → `finally` garante reset.
   - `qrError` mostra card de erro com botão "Tentar novamente".
   - Steps refletem o estado real (sem ficar "active" preso).

5. Botão "Já escaneei" continua disponível como fallback manual mesmo com polling automático.

### O que NÃO muda

- `src/utils/evolution.functions.ts`: `createInstance`, `getQrCode`, `getInstanceStatus` permanecem como estão. A correção é puramente de orquestração no frontend.
- Tabelas Supabase, RLS e migrações: nada novo.
- Demais abas (Mensagem, Contatos, Envio): intocadas.

### Detalhes técnicos

- Usar `withRequestTimeout` em todas as chamadas dentro do `bootstrapConnection` para evitar promessas penduradas (timeout 12s já configurado).
- Polling com `useRef<NodeJS.Timeout | null>` para o `setInterval` + `useRef<number>` para contar tentativas.
- Quando `getInstanceStatus` retornar `success: false` durante polling, **não** parar o polling imediatamente (pode ser blip de rede); só parar após 3 falhas consecutivas e mostrar `qrError`.
- Atualização do banco usa o client `supabase` (RLS garante isolamento por `user_id`).
- Nenhum `await` fica fora de `try/catch/finally` que controle `loading`/`connecting`.

### Resultado esperado

- Abrir aba já conectada → spinner curto → tela "WhatsApp conectado" sem chamar `createInstance` nem `getQrCode`.
- Abrir aba com instância criada mas desconectada → spinner curto → QR aparece automaticamente + polling detecta a leitura.
- Abrir aba sem instância → spinner curto → botão "Conectar WhatsApp" habilitado.
- Em qualquer erro (timeout, API fora) → card vermelho com mensagem e botão "Tentar novamente". Nunca spinner infinito.

