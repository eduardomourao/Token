# 13 — afinidade de sessão hospedada

**What to build:** manter uma sessão de cliente na mesma Account enquanto ela
continuar elegível, sem persistir identificadores de sessão em texto claro.

**Status:** implemented

- [x] Derivar `x-codex-session-id` com SHA-256 no limite da Edge Function.
- [x] Persistir somente hash, proprietário, Account e expiração de 24 horas em
  tabela privada com RLS forçado.
- [x] Resolver a Account aderente somente quando ativa e com quota conhecida
  disponível; voltar à seleção hospedada quando não houver vínculo elegível.
- [x] Renovar o vínculo após uma seleção normal, sem gravar a sessão original.
- [x] Manter as RPCs exclusivas de `service_role` e validar o contrato com
  testes Bun e Python.
- [x] Aplicar migration e publicar `proxy-responses` no Supabase isolado.

## Limite declarado

A afinidade depende do header opcional `x-codex-session-id`; Requests sem esse
header continuam usando a seleção normal. O vínculo não transforma a Edge
Function em transporte persistente: WebSocket e replay/resume seguem fora do
contrato hospedado.
