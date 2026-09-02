# 16 — compatibilidade WebSocket e replay hospedado

**What to decide and build:** preservar clientes WebSocket do proxy legado sem
declarar o protocolo Supabase Realtime equivalente ao protocolo OpenAI.

**Status:** implementation — create relay proven; cancel/replay pending

- [x] Inventariar o runtime legado: WebSocket envolve sessão persistente,
  replay/resume, recuperação, quota, afinidade e controle de concorrência.
- [x] Verificar fontes oficiais: Supabase Realtime oferece WebSocket próprio,
  Broadcast privado e replay, mas usa protocolo Phoenix; clientes existentes
  não o consumirão sem adaptador de protocolo.
- [x] Verificar Vercel: suporte recente a WebSocket não promete que conexões
  futuras caiam na mesma instância; estado durável continua externo.
- [x] Definir o desenho mínimo seguro: Function Vercel aceita o socket e
  encaminha somente `response.create` autenticado ao relay HTTP/SSE; o
  Supabase deve armazenar o spool de eventos e o cursor por resposta para
  reconexão/replay.
- [x] Provar o gateway com `@vercel/functions` + `ws`: handshake autenticado,
  conversão incremental SSE→frames OpenAI, cancelamento, limite de duração e
  erro terminal seguro.
- [~] Provar persistência no Supabase: spool owner-scoped, cursor de replay,
  retenção, retomada em outra Function e recusa explícita quando uma saída já
  visível não puder ser repetida sem duplicação.
- [x] Executar teste ponta a ponta contra deploy Vercel e cliente WebSocket
  compatível antes de publicar a rota `wss` no caminho nativo.

## Limite declarado

Não é válido trocar `wss://.../backend-api/codex/responses` por um canal
Phoenix do Supabase e chamar isso de paridade. A rota HTTP/SSE de Responses
permanece publicada e é o único contrato de inferência hospedado comprovado
até este ticket receber uma prova de protocolo ponta a ponta.

## Decisão de implementação

A Vercel documenta `experimental_upgradeWebSocket()` para Functions de outros
frameworks, portanto o app Vite não exige migração para Next.js. Porém a API
exige `@vercel/functions` e `ws`, não roda localmente fora de Next.js e a
conexão continua limitada à duração da Function. A implementação deve ser
validada por deploy remoto e manter todo estado de retomada no Supabase; não
deve depender de memória da Function nem do Runtime Cache da Vercel.

## Evidência de implementação — 2026-09-02

- O adaptador puro valida `response.create`, preserva o default legado de
  `stream`, decodifica SSE fragmentado e rejeita frames inválidos antes de
  qualquer relay.
- A nova Function isolada `/api/hosted-ws-probe` exige um preflight do
  `proxy-responses` antes de tentar `experimental_upgradeWebSocket()`, limita
  a mensagem a 256 KiB, normaliza a entrada abreviada para o contrato interno
  e grava cada evento já decodificado no spool antes de enviá-lo. Ela não toca
  nos caminhos nativos.
- O `proxy-responses` publicado no projeto `mtokqhqdkkxbyvgjwyvu` reconhece o
  preflight exato somente depois de autenticar JWT ou API key. Um POST sem
  credencial retornou `401 unauthorized`, sem seleção de conta.
- O banco hospedado agora possui spool privado, curto e owner-scoped, cursor
  monotônico e leitura somente via RPC `service_role`. RLS está habilitada e
  forçada nas duas tabelas; o create relay já grava eventos, mas a rota de
  replay ainda não está exposta.
- O deploy remoto comprovou `101 Switching Protocols` para uma chave temporária
  autenticada e `401` antes de upgrade sem Bearer. A chave de prova foi
  removida no mesmo fluxo; a consulta posterior confirmou zero chaves de
  teste persistidas.

### Evidência de relay durável — 2026-09-02

- Uma chamada mínima autenticada ao caminho isolado recebeu, em ordem,
  `response.created`, `response.in_progress`, eventos de item/conteúdo,
  `response.output_text.delta`, `response.output_text.done` e
  `response.completed`.
- O spool correspondente registrou nove eventos, `next_cursor = 9` e
  `terminal_cursor = 9`; a consulta estrutural não encontrou `input` no topo
  nem em `response.input`. Nenhum payload de evento foi exibido durante a
  validação.
- A chave temporária foi removida no fluxo e a consulta posterior encontrou
  zero chaves de prova persistidas. O lint remoto do schema passou.
