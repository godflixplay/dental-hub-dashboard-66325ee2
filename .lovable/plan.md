

## Plano: Corrigir destinatário errado e status defasado de WhatsApp

### Problema 1 — Mensagem indo para o número errado

A Evolution API exige número no formato internacional completo (`55` + DDD + número, total 12 ou 13 dígitos). Quando recebe um número curto/inválido, ela entrega na própria conversa da instância (o que vemos na imagem 1: as mensagens aparecem no chat de `21981089100`, que é a própria instância).

**Solução:** normalizar o telefone no frontend antes de enviar e validar formato.

### Problema 2 — UI mostra "desconectado" ao voltar na tela

`EnvioTab` lê apenas `whatsapp_instances.status` do banco, que pode estar defasado em relação à Evolution. Além disso, o timeout de 12s estoura quando a Evolution API está lenta, derrubando o load inteiro.

**Solução:** consultar `getInstanceStatus` ao carregar EnvioTab, sincronizar com o banco e aumentar o timeout para chamadas à Evolution.

### Mudanças por arquivo

**`src/components/aniversarios/phone-utils.ts`** (novo)
- `normalizePhoneBR(input: string): { phone: string; valid: boolean; reason?: string }` — remove tudo que não é dígito, garante DDI `55` no início, valida 12-13 dígitos, valida DDD plausível (11-99). Retorna `{phone, valid, reason}`.
- Exporta também `formatPhoneDisplay` para exibir formatado.

**`src/components/aniversarios/EnvioTab.tsx`**
1. Importar `normalizePhoneBR`. Em `handleSend`:
   - Normalizar `phone` antes de chamar `sendTextMessage`. Se inválido, abortar com toast claro: "Número inválido. Use formato 55DDXXXXXXXXX (ex: 5521981089100)".
   - Gravar o telefone normalizado no histórico `envios.telefone` (assim o histórico fica consistente).
2. Ao carregar (`fetchAll`), depois de pegar `instance_name` do banco, chamar `getInstanceStatus` em paralelo com timeout maior (20s) e usar **o estado real da Evolution** como `instanceStatus` — não o campo do banco. Se Evolution disser `open`, atualiza o banco para `connected`; senão atualiza para `disconnected`. Isso elimina a inconsistência ao voltar na tela.
3. Mensagem de erro específica para timeout sugerindo "Tente novamente, a Evolution API pode estar lenta".

**`src/components/aniversarios/ContatosTab.tsx`**
- Ao salvar/importar contato, normalizar telefone com `normalizePhoneBR`. Se inválido, rejeitar com mensagem. Isso impede que contatos com DDI faltando contaminem futuros envios.
- Para importação em massa, exibir resumo: "X contatos importados, Y rejeitados por número inválido".

**`src/components/aniversarios/request-utils.ts`**
- Adicionar segunda exportação `withEvolutionTimeout` com 25s (ou aceitar parâmetro `timeoutMs`). Evolution API ocasionalmente leva mais que 12s.
- `EnvioTab` e `WhatsAppTab` usam o timeout maior em chamadas à Evolution; chamadas Supabase puras continuam com 12s.

**`src/components/aniversarios/MensagemTab.tsx`** — sem mudanças.

**`src/utils/evolution.functions.ts`** — sem mudanças (a normalização ocorre no client antes de chegar aqui; o schema atual `phone: 10-20 dígitos` continua válido).

### Como o usuário vai perceber

- Tentar enviar para `21969622045` → toast: "Número inválido. Use formato 55DDXXXXXXXXX". Não envia.
- Digitar `21981089100` → normalizado para `5521981089100` automaticamente, envio segue.
- Voltar na aba Envio depois de conectar → status "WhatsApp Conectado" correto, sem precisar reabrir a aba WhatsApp, porque o status é lido em tempo real da Evolution.
- Se Evolution demorar 15s → ainda funciona (timeout subiu para 25s); se exceder, mensagem de erro clara em vez de tela quebrada.

### Detalhes técnicos

- Validação BR: `^55(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[13-5]|6[1-9]|7[13479]|8[1-9]|9[1-9])\d{8,9}$` — DDD válido + 8 ou 9 dígitos do número.
- Sincronização de status: dentro do `try` do `fetchAll`, após obter `instanceRes.data.instance_name`, executar `getInstanceStatus` e fazer `await supabase.from("whatsapp_instances").update({status: realStatus}).eq("id", instanceId)` em fire-and-forget (não bloqueia render).
- Não causa loop: a sincronização só roda quando `fetchAll` é chamado (mount + após envio), não em intervalo.
- Sem mudanças de banco/migração.

