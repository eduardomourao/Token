# 14 — atualização Realtime do Dashboard hospedado

**What to build:** invalidar a leitura proprietária do Dashboard assim que uma
nova quota da mesma sessão autenticada for gravada no Supabase.

**Status:** implemented

- [x] Criar seam testável que assine mudanças somente nas tabelas públicas já
  publicadas no Realtime.
- [x] Invalidar a query `hosted-dashboard-read-model` quando houver evento.
- [x] Cancelar a assinatura ao desmontar a página.
- [x] Manter o intervalo de 60 s como recuperação para queda de conexão.
- [x] Executar testes, typecheck e build; publicar pelo fluxo GitHub–Vercel.

## Limite declarado

Realtime acelera a atualização visual após uma gravação; ele não transforma os
coletores em processos contínuos. Eventos permanecem sujeitos às políticas RLS
do proprietário, e nenhuma tabela privada de credenciais participa da
assinatura.
