

## Plano: corrigir envio com imagem, instância errada, status enganoso e erro ao voltar para a aba

### O que está realmente errado

1. **A imagem nunca é enviada**
   - Hoje a aba Mensagem salva `imagem_url`, mas a aba Envio chama apenas `sendTextMessage`.
   - Resultado: o sistema sempre envia só texto.

2. **As mensagens estão saindo da instância errada**
   - `WhatsAppTab.tsx` usa um nome fixo de instância: `DentalHubTeste`.
   - Isso faz usuários diferentes reutilizarem a mesma instância da Evolution.
   - Como a instância conectada está no número `21981089100`, a mensagem aparece nessa conversa, não no destinatário esperado.

3. **`pendente` não significa entregue**
   - A própria documentação da Evolution mostra retorno `status: "PENDING"` logo após `sendText` e `sendMedia`.
   - Isso significa “aceita pela API”, não “chegou no WhatsApp do destinatário”.
   - O sistema hoje grava esse retorno como se fosse um estado final, o que confunde.

4. **A aba Envio quebra ao voltar**
   - `fetchAll` usa um `Promise.all` único com timeout geral.
   - Se qualquer consulta demorar, especialmente a parte da Evolution, a aba inteira falha com erro de carregamento.
   - Além disso, o status real da instância está sendo conciliado de forma frágil.

### Mudanças por arquivo

**`src/components/aniversarios/WhatsAppTab.tsx`**
- Remover `INSTANCE_NAME_FIXED = "DentalHubTeste"`.
- Gerar um `instance_name` único por usuário, estável e previsível, por exemplo baseado no `user.id`.
- Ao abrir a aba:
  - buscar a instância do usuário no banco;
  - se existir, usar **somente** essa instância;
  - se não existir, criar uma nova instância exclusiva do usuário.
- Ao detectar que a instância salva pertence ao usuário atual, nunca reutilizar instância compartilhada.
- Melhorar estados finais da tela: `conectado`, `aguardando QR`, `erro`, sem loading preso.

**`src/utils/evolution.functions.ts`**
- Manter `sendTextMessage`, mas adicionar `sendMediaMessage`.
- `sendMediaMessage` chama `/message/sendMedia/{instance}` usando:
  - `number`
  - `caption`
  - `media`
  - `mimetype`
  - `mediatype`
  - `fileName`
- Retornar também `providerStatus`, `messageId` e `remoteJid` quando vierem na resposta.
- Em `createInstance`, continuar tratando “already in use”, mas agora com nome único por usuário.
- Melhorar parsing das respostas da Evolution para logs e diagnóstico.

**`src/components/aniversarios/EnvioTab.tsx`**
- Se `config.imagem_url` existir, enviar com `sendMediaMessage`; senão, usar `sendTextMessage`.
- Antes do envio:
  - validar número com `normalizePhoneBR`;
  - checar status real da instância com a Evolution, sem depender só do banco.
- Separar o carregamento inicial em etapas:
  - carregar Supabase primeiro;
  - verificar status da Evolution depois, sem derrubar a aba inteira se a Evolution estiver lenta.
- Evitar que um timeout da Evolution impeça a renderização dos contatos, histórico e configuração.
- Ajustar o histórico:
  - manter `pendente` como “aceita pela Evolution, entrega final não confirmada”;
  - mostrar tooltip/texto mais claro;
  - exibir se o envio foi `texto` ou `imagem + legenda`.
- Quando houver erro real da Evolution, registrar erro detalhado no histórico.

**`src/components/aniversarios/MensagemTab.tsx`**
- Manter upload/salvamento como origem da imagem.
- Melhorar feedback visual:
  - mostrar claramente “imagem salva e pronta para envio”;
  - diferenciar preview local (`blob:`) de imagem já persistida (`imagem_url`).
- Garantir que remover imagem limpe corretamente o estado salvo e o preview.

**`src/components/aniversarios/request-utils.ts`**
- Manter timeout separado para Evolution.
- Adicionar mensagem específica para timeout da Evolution, sem transformar isso em falha total da aba.
- Permitir usar timeout customizado por chamada quando necessário.

### Ajuste de arquitetura importante

**Instância exclusiva por usuário**
- Cada usuário precisa ter sua própria instância na Evolution.
- O nome da instância deve ser algo como:
  - `dentalhub-{userIdCurto}`
  - ou `aniv-{user.id}`
- Isso elimina o principal bug atual: mensagens saindo do WhatsApp de outra pessoa.

### Como o comportamento vai ficar

```text
Usuário abre aba WhatsApp
  -> sistema busca a instância dele no banco
  -> consulta /instance/connectionState/{instance_name}
  -> se open: conectado
  -> se não open: gera QR dessa mesma instância
  -> se não existir instância: cria uma nova exclusiva do usuário
```

```text
Usuário abre aba Envio
  -> contatos/config/histórico carregam do Supabase
  -> status da Evolution é consultado separadamente
  -> a tela nunca fica travada inteira por causa de uma chamada lenta
```

```text
Usuário envia mensagem
  -> sem imagem: /message/sendText/{instance}
  -> com imagem: /message/sendMedia/{instance}
  -> histórico registra aceite da Evolution e detalhes retornados
```

### Resultado esperado

- A imagem configurada passa a ser enviada de fato.
- A mensagem sai da instância correta do usuário, não do número `21981089100`.
- O destinatário `21969622045` passa a receber na conversa dele.
- O status `pendente` deixa de parecer bug e passa a ser descrito corretamente como “aceito, aguardando confirmação final”.
- Ao sair e voltar para a aba, a tela não quebra por timeout geral.
- O layout continua responsivo nas quatro abas.

### Detalhes técnicos

- A causa mais grave é o nome fixo `DentalHubTeste`, que cria compartilhamento indevido de instância.
- `sendMedia` é obrigatório para suportar `imagem_url`; salvar imagem no banco sozinho não envia mídia.
- O `status: "PENDING"` é comportamento esperado da Evolution no retorno inicial; não deve ser tratado como confirmação de entrega.
- Para confirmação real de entrega no futuro, o ideal é salvar `messageId/providerStatus` e integrar webhook/status callback da Evolution.

### Arquivos a editar

- `src/components/aniversarios/WhatsAppTab.tsx`
- `src/components/aniversarios/EnvioTab.tsx`
- `src/components/aniversarios/MensagemTab.tsx`
- `src/components/aniversarios/request-utils.ts`
- `src/utils/evolution.functions.ts`

### Validação após implementar

1. Conectar um usuário novo e confirmar que a instância criada tem nome exclusivo.
2. Salvar mensagem com imagem e verificar preview persistido.
3. Enviar para `21969622045` e confirmar que:
   - não aparece mais na conversa da instância errada;
   - usa `sendMedia` quando houver imagem.
4. Sair da aba e voltar para confirmar que não há erro de carregamento.
5. Testar em viewport menor para garantir responsividade das abas, badges, cards e histórico.

