# 06 — Decisão de escopo do proxy persistente

**What to build:** uma decisão aceita para o proxy OpenAI, SSE e WebSocket persistente: manter fora do corte inicial, reduzir contratos de forma explícita ou escolher runtime adicional.

**Blocked by:** None — decision required before any proxy migration.

**Status:** accepted

- [x] A decisão registra os contratos preservados, reduzidos ou adiados.
- [x] O impacto em clientes existentes e o rollback são explícitos.
- [x] Nenhuma rota persistente é movida sem testes de compatibilidade correspondentes.

## Decisão aceita em 2026-09-01

O proxy será migrado em verticais para uma **Supabase Edge Function**, sem um
quarto provedor de runtime. A Vercel permanece a aplicação web; a função
recebe a requisição autenticada, lê somente o estado privado necessário e
encaminha ao upstream. As credenciais OAuth ficam no schema `app`, fora da API
do navegador, recriptografadas com uma chave de função separada.

### Primeiro contrato hospedado

- Preserva `POST /v1/responses` via a função `proxy-responses`, incluindo
  resposta JSON concluída e relay de SSE quando `stream: true`.
- Exige JWT do Supabase do proprietário; as tabelas privadas não têm grants
  para `anon` nem `authenticated`.
- Seleciona uma Account ativa do mesmo proprietário de modo determinístico.
- Não reenvia o JWT do usuário ao upstream: substitui-o exclusivamente pelo
  access token decriptado dentro da função.

### Contratos explicitamente adiados

- WebSocket de `/v1/responses` e `/v1/realtime`;
- replay/resume, leases, failover, afinidade de sessão e circuit breakers;
- `backend-api/codex`, compactação, arquivos, imagens, áudio, model sources e
  a administração de API keys.

Esses contratos serão adicionados um por vez com testes de compatibilidade e
não serão anunciados como suportados pelo endpoint inicial.

### Rollback

O runtime FastAPI e o snapshot externo continuam intactos. Remover a rota de
entrada hospedada ou desativar a Edge Function retorna os clientes ao runtime
anterior sem alterar a base SQLite de origem.
