# 10 — rotação hospedada de OAuth

**What to build:** renovar access tokens rotativos sem expor OAuth e sem duas
execuções consumirem o mesmo refresh token.

**Status:** implemented

- [x] Criar claim privada por conta, com expiração curta e RLS forçado.
- [x] Usar compare-and-set do ciphertext de refresh token ao persistir a
  família rotacionada de access/refresh/id tokens.
- [x] Aplicar a rotação tanto no coletor de quota quanto em `POST /v1/responses`
  após um único HTTP 401.
- [x] Repetir a chamada upstream apenas uma vez com o access token recém-rotacionado.
- [x] Marcar `reauth_required` somente para erros OAuth permanentes conhecidos.
- [x] Verificar a claim remota sem executar OAuth: aquisição retornou `true`,
  liberação concluiu e não deixou claims residuais.

## Limite declarado

O caminho de rotação foi compilado e publicado, mas não foi forçado contra uma
conta proprietária válida: não se consome um refresh token saudável apenas para
teste. A primeira expiração real fará a troca automática; o monitor mantém
estado e falhas observáveis sem revelar credenciais.
