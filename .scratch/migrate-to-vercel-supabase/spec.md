# Migração do dashboard para GitHub, Vercel e Supabase

## Problem Statement

O produto atual depende de um runtime FastAPI persistente, banco e arquivos locais. O objetivo é publicar gradualmente o painel e os monitores em uma arquitetura composta por GitHub, Vercel e Supabase, sem expor segredos, perder dados ou substituir o comportamento existente sem evidência de paridade.

## Solution

O GitHub se torna a fonte versionada e o ponto de CI. A Vercel atende a interface e operações curtas sob demanda. O Supabase passa a hospedar dados relacionais, autenticação, atualizações Realtime e coletores periódicos idempotentes. A versão atual permanece a referência até que cada fluxo tenha sido validado em modo paralelo e um rollback tenha sido ensaiado.

O proxy OpenAI atual, streaming e WebSockets persistentes são tratados como uma decisão de escopo independente. O primeiro vertical hospedado preserva somente `POST /v1/responses` (JSON concluído e SSE), executado por Supabase Edge Function com JWT de proprietário e credenciais em schema privado. WebSocket, replay, afinidade, failover, API keys e rotas auxiliares continuam fora desse vertical até que cada contrato tenha testes de compatibilidade próprios.

## User Stories

1. Como operador, quero que o painel continue disponível sem administrar um servidor próprio.
2. Como operador, quero que os limites de uso sejam atualizados automaticamente sem recarregar a página.
3. Como operador, quero visualizar uma coleta recente e saber quando ela ocorreu.
4. Como administrador, quero que cada usuário só veja os dados que lhe pertencem.
5. Como administrador, quero manter segredos de provedores fora do navegador e do Git.
6. Como mantenedor, quero previews verificáveis antes de qualquer publicação em produção.
7. Como mantenedor, quero migrar dados sem sobrescrever a origem antes de conferir contagens e integridade.
8. Como mantenedor, quero retornar ao runtime atual se um fluxo migrado divergir.
9. Como usuário do monitor PWA, quero preservar seleção, swipe e atualização automática.
10. Como usuário do proxy, quero que sua continuidade seja uma decisão explícita e não uma regressão silenciosa.
11. Como operador, quero abrir um Dashboard hospedado e consultar contas e quotas atuais sem expor os tokens das contas.
12. Como operador, quero que o Dashboard hospedado apresente somente dados que pertencem à minha sessão Supabase.
13. Como mantenedor, quero importar o modelo de leitura de maneira repetível e comparável à base local.

## Implementation Decisions

- O primeiro incremento é uma fundação sem credenciais e sem publicação: Git local, configuração versionável de Vercel/Supabase e CI de validação.
- A primeira funcionalidade migrada deve ser um fluxo vertical de leitura e monitoramento, não o proxy.
- Coletores executam por Cron em intervalos curtos, começam em um minuto, são idempotentes e gravam o resultado antes de notificar pelo Realtime.
- Dados relacionais são propriedade do Supabase Postgres; as políticas RLS protegem cada leitura e escrita do cliente.
- Segredos de provedores ficam somente em configurações de servidor/função. Dados criptografados exigem preservação da chave de origem e validação de descriptografia em staging.
- O projeto de Vercel não recebe IDs, tokens, URLs sensíveis nem migrações automáticas dentro do repositório.
- Nenhum deploy de produção, push ou mudança no Supabase é feito sem um estágio de preview e uma decisão explícita de promoção.
- O Dashboard hospedado começa como modelo de leitura: copia metadados não secretos de contas e históricos de quota, mas não transporta tokens OAuth, configurações de proxy, chaves de API ou operações de routing.
- A interface hospedada usa uma fronteira de dados Supabase que entrega o contrato de leitura do Dashboard e torna explícitos os módulos ainda não hospedados.

## Testing Decisions

- Testes de contrato verificam os dados que cada tela e coletor observa, não detalhes internos de framework.
- Testes de RLS exercitam usuário autorizado, usuário não autorizado e acesso de serviço.
- Testes de funções programadas cobrem idempotência, falha de provedor, reexecução e publicação Realtime somente após persistência.
- Testes de paridade comparam telas, rotas e valores do runtime atual e do fluxo novo para o mesmo conjunto de dados.
- Testes do importador comparam contagens, identificadores estáveis e os campos permitidos entre SQLite e Supabase, comprovando que nenhum campo criptografado entra no modelo hospedado.
- O corte requer ensaio de exportação, importação, comparação e rollback.

## Out of Scope

- Declarar WebSocket, replay, afinidade, failover, API keys ou as rotas auxiliares do proxy como compatíveis sem uma especificação de compatibilidade própria.
- Publicar credenciais, criar projetos externos, migrar dados reais, trocar domínio ou enviar commits ao GitHub nesta fundação.
- Proxy de inferência, WebSocket, SSE persistente, automações, chaves de API e operações de OAuth/routing no Dashboard hospedado de leitura.

## Further Notes

O snapshot validado em `C:\Users\Admin\Downloads\codex-lb-backups\codex-lb-main-source-snapshot-before-vercel-supabase-20260829-234606` é a referência local de restauração para esta mudança.
