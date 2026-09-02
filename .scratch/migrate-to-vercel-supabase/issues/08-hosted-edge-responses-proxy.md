# 08 — Proxy hospedado de Responses por Edge Function

**What to build:** o primeiro contrato verificável do proxy em Supabase Edge:
credenciais privadas recriptografadas, `POST /v1/responses` autenticado e
relay SSE/JSON sem expor tokens no navegador.

**Blocked by:** ticket 06 accepted.

**Status:** in-progress

- [x] Definir schema privado sem grants de navegador.
- [x] Criar importador read-only que recriptografa Fernet local em AES-GCM.
- [x] Cobrir envelope, filtragem de cabeçalhos e SSE com testes locais.
- [x] Aplicar migração no projeto Supabase isolado e importar as credenciais.
- [x] Publicar a função e comprovar 401 sem JWT, leitura privada pelo papel de serviço e 409 para um JWT válido sem Account vinculada.
- [ ] Confirmar relay upstream com um fluxo real sem imprimir credenciais.

## Compatibilidade intencional

Esta vertical não substitui o runtime persistente inteiro. Ela preserva apenas
o contrato HTTP de Responses, e mantém WebSocket, afinidade, replay,
failover e as demais rotas em tickets posteriores.

## Transporte no domínio Vercel

A borda da Vercel remove `Authorization` das requisições externas de
`/v1/responses`. Por isso, clientes que usam o domínio Vercel devem enviar o
JWT do Supabase em `x-supabase-authorization: Bearer <jwt>`. A função Vercel
reconstrói `Authorization` somente para a Edge Function; esse cabeçalho nunca
segue ao upstream ChatGPT.
