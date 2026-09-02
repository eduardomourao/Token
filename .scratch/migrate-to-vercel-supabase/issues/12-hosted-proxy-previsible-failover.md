# 12 — failover hospedado antes de saída visível

**What to build:** tentar uma segunda Account somente quando o primeiro
upstream falhou antes de devolver conteúdo ao cliente.

**Status:** implemented

- [x] Limitar a uma tentativa de fallback para `POST /v1/responses` JSON.
- [x] Disparar somente após HTTP 429, depois de persistir o cooldown da conta
  original.
- [x] Selecionar novamente pelo seletor hospedado, que exclui a conta recém
  rate-limited.
- [x] Persistir o cooldown também se a segunda Account retornar 429.
- [x] Excluir `stream: true` para não duplicar uma SSE visível.
- [x] Publicar a função e executar testes de contrato.

## Limite declarado

Esta é uma recuperação determinística de pré-saída. Erros 5xx e problemas de
rede ainda são devolvidos sem migrar a requisição, e WebSocket/replay continuam
fora do contrato hospedado.
