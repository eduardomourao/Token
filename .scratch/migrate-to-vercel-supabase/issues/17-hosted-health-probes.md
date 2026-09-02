# 17 — probes de saúde hospedados

**What to build:** manter os endpoints de saúde do runtime legado para a
plataforma Vercel, sem declarar estado de processos persistentes inexistentes.

**Status:** implemented

- [x] Portar `/health`, `/health/live`, `/health/ready` e `/health/startup`.
- [x] Manter o payload legado mínimo `{ "status": "ok" }` em `/health`.
- [x] Expor o escopo real nos demais probes: runtime Vercel e transporte
  hospedado HTTP/SSE.
- [x] Cobrir o contrato com testes de borda e build Vite.

## Limite declarado

`/health/ready` confirma que a Function hospedada respondeu; não afirma que
WebSocket, bridge ring ou workers persistentes estão ativos, pois estes não
existem neste corte Vercel + Supabase.
