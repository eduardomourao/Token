# 15 — API keys hospedadas para Responses

**What to build:** oferecer API keys novas para `POST /v1/responses` no modo
hospedado, equivalentes ao contrato de Bearer key do proxy legado, sem migrar
segredos inexistentes da origem.

**Status:** implemented

- [x] Inventariar a fonte SQLite em modo read-only: há 0 API keys, portanto
  nenhuma chave preexistente deve ser copiada ou recriada.
- [x] Criar armazenamento privado de hash/prefixo, expiração e revogação com
  RLS forçado e RPCs de `service_role`.
- [x] Criar Edge Function autenticada por Supabase Auth para criação, listagem
  e revogação; retornar a chave somente uma vez na criação.
- [x] Permitir Bearer key válida no proxy, resolvendo proprietário via hash e
  removendo a credencial antes da chamada upstream.
- [x] Oferecer página hospedada mínima para administrar chaves de Responses.
- [x] Validar segurança, testes, migrations, funções e deploy GitHub–Vercel.

## Limite declarado

Esta vertical cobre exclusivamente `POST /v1/responses`. As regras legadas de
limites por modelo, atribuições, consumo, relatórios e demais rotas exigem
vertical própria; não serão fingidas como suportadas.
