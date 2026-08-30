# 06 — Decisão de escopo do proxy persistente

**What to build:** uma decisão aceita para o proxy OpenAI, SSE e WebSocket persistente: manter fora do corte inicial, reduzir contratos de forma explícita ou escolher runtime adicional.

**Blocked by:** None — decision required before any proxy migration.

**Status:** ready-for-human

- [ ] A decisão registra os contratos preservados, reduzidos ou adiados.
- [ ] O impacto em clientes existentes e o rollback são explícitos.
- [ ] Nenhuma rota persistente é movida sem testes de compatibilidade correspondentes.
