# 11 — estado persistente de rate limit hospedado

**What to build:** excluir de forma durável uma conta que recebeu `429`, usando
o prazo do upstream, e permitir recuperação automática após esse prazo.

**Status:** implemented

- [x] Persistir `rate_limited`, `blocked_at` e `reset_at` somente por RPC de
  `service_role`.
- [x] Usar `Retry-After` quando válido, com fallback de 30 segundos e teto de
  uma hora.
- [x] Recuperar limites expirados antes da seleção hospedada seguinte.
- [x] Manter o comportamento de stream sem retry entre contas nesta etapa.
- [x] Aplicar migration e publicar `proxy-responses`.

## Escopo

Esta etapa torna o próximo request elegível para outra conta em vez de repetir
imediatamente a conta rate-limited. O retry/failover no mesmo request só será
adicionado para chamadas sem streaming, porque uma resposta SSE visível não é
segura para duplicar.
