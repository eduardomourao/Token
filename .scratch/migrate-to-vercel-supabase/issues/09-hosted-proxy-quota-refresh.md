# 09 — atualização hospedada de quota do proxy

**What to build:** uma Edge Function curta e agendada que atualiza as janelas
de quota usadas pelo seletor hospedado, sem permitir leitura de credenciais pelo
navegador.

**Blocked by:** ticket 08 em andamento; a seleção privada já está disponível.

**Status:** implemented

- [x] Ler somente contas roteáveis e o envelope de access token via RPC de
  `service_role`.
- [x] Decriptar o token apenas na Edge Function e chamar `GET /wham/usage`.
- [x] Registrar as janelas no read model público sem enviar qualquer segredo.
- [x] Marcar somente HTTP 401 como `reauth_required`; uma falha transitória
  não desativa a conta.
- [x] Agendar a execução a cada cinco minutos por `pg_cron` + Vault.
- [x] Confirmar execução remota: HTTP 200, cinco contas atualizadas e novas
  linhas de quota persistidas.

## Limites declarados

Esta etapa ainda não renova OAuth: usa o access token que foi importado e
classifica expiração como `reauth_required`. O próximo vertical deve renovar o
refresh token em segredo e recriptografar a rotação sem expor material OAuth.
Também não implementa retry/failover dentro da mesma requisição de Responses.
