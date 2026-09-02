# 16 — compatibilidade WebSocket e replay hospedado

**What to decide and build:** preservar clientes WebSocket do proxy legado sem
declarar o protocolo Supabase Realtime equivalente ao protocolo OpenAI.

**Status:** discovery

- [x] Inventariar o runtime legado: WebSocket envolve sessão persistente,
  replay/resume, recuperação, quota, afinidade e controle de concorrência.
- [x] Verificar fontes oficiais: Supabase Realtime oferece WebSocket próprio,
  Broadcast privado e replay, mas usa protocolo Phoenix; clientes existentes
  não o consumirão sem adaptador de protocolo.
- [x] Verificar Vercel: suporte recente a WebSocket não promete que conexões
  futuras caiam na mesma instância; estado durável continua externo.
- [ ] Definir e provar um gateway compatível com o WebSocket OpenAI, ou manter
  explicitamente o contrato hospedado limitado a HTTP/SSE.

## Limite declarado

Não é válido trocar `wss://.../backend-api/codex/responses` por um canal
Phoenix do Supabase e chamar isso de paridade. A rota HTTP/SSE de Responses
permanece publicada e é o único contrato de inferência hospedado comprovado
até este ticket receber uma prova de protocolo ponta a ponta.
