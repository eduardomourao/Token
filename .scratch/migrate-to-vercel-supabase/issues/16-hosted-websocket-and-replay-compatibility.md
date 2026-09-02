# 16 — compatibilidade WebSocket e replay hospedado

**What to decide and build:** preservar clientes WebSocket do proxy legado sem
declarar o protocolo Supabase Realtime equivalente ao protocolo OpenAI.

**Status:** implementation — isolated upgrade probe

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
- [~] Provar o gateway com `@vercel/functions` + `ws`: handshake autenticado,
  conversão incremental SSE→frames OpenAI, cancelamento, limite de duração e
  erro terminal seguro.
- [~] Provar persistência no Supabase: spool owner-scoped, cursor de replay,
  retenção, retomada em outra Function e recusa explícita quando uma saída já
  visível não puder ser repetida sem duplicação.
- [ ] Executar teste ponta a ponta contra deploy Vercel e cliente WebSocket
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
  a mensagem a 256 KiB e responde somente com um evento de probe. Ela não
  encaminha input, não cria spool e não toca nos caminhos nativos.
- O `proxy-responses` publicado no projeto `mtokqhqdkkxbyvgjwyvu` reconhece o
  preflight exato somente depois de autenticar JWT ou API key. Um POST sem
  credencial retornou `401 unauthorized`, sem seleção de conta.
- O banco hospedado agora possui spool privado, curto e owner-scoped, cursor
  monotônico e leitura somente via RPC `service_role`. RLS está habilitada e
  forçada nas duas tabelas; a Function ainda não grava eventos, portanto não
  há replay exposto antes do teste ponta a ponta.
