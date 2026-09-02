# Descobertas: migração para GitHub, Vercel e Supabase

## Backup

- Snapshot válido: `C:\Users\Admin\Downloads\codex-lb-backups\codex-lb-main-source-snapshot-before-vercel-supabase-20260829-234606`.
- O snapshot contém 4.507 arquivos e 45.776.220 bytes, conferidos contra a origem; hashes SHA-256 de arquivos críticos também coincidem.
- Foram excluídos somente diretórios regeneráveis: `.venv`, `node_modules`, caches de teste/lint, `__pycache__`, `.vite` e `coverage`.
- O arquivo `codex-lb-main-before-vercel-supabase-20260829-231945.tar.gz` está truncado e não deve ser usado para restauração.

## Runtime atual

- `app/main.py` inicia o FastAPI e gerencia o ciclo de vida de ao menos quinze schedulers, além de ingestão ao vivo, cache/invalidação, métricas, heartbeat e eleição de líder.
- O proxy implementa SSE e WebSockets, política de reconexão, limites de concorrência e estado de sessão.
- O diretório de dados pode conter SQLite, chave de criptografia, arquivos de depuração e arquivos de conversa; o banco também pode usar PostgreSQL por `CODEX_LB_DATABASE_URL`.
- O frontend Vite já é servido como artefato estático pelo backend e contém o monitor PWA de uso.

## Consequências de arquitetura

| Capacidade | Destino preliminar | Observação |
|---|---|---|
| Painel React/PWA | Vercel | Requer substituir chamadas ao backend por interfaces de aplicação adequadas. |
| Dados relacionais e históricos | Supabase Postgres | Exige migrações, RLS e validação de integridade. |
| Login do painel | Supabase Auth | Exige mapeamento explícito do modelo de sessão/admin atual. |
| Atualização de limites | Supabase Cron + Edge Functions | Cadência inicial proposta: 1 minuto; cada execução deve ser curta, idempotente e observável. |
| Atualização visual após gravação | Supabase Realtime | A tela atualiza sem recarga depois que uma coleta conclui. |
| Segredos de provedores | Supabase Vault/segredos de função e Vercel env vars | Nunca retornar segredos para o navegador ou armazená-los em Git. |
| Proxy HTTP/SSE/WebSocket persistente | Decisão pendente | Não deve ser declarado equivalente em ambiente serverless sem uma prova específica. |

## Evidências locais

- `app/main.py`: composição do lifespan, schedulers e tarefas de longa duração.
- `app/core/config/settings.py`: diretório de dados, banco, chave de criptografia e políticas de WebSocket.
- `app/core/clients/proxy_websocket.py`: cliente/protocolos de WebSocket do proxy.
- `app/modules/usage/live_ingest.py`: ingestão de uso em segundo plano.
- `docker-compose.prod.yml`: runtime atual em contêiner com PostgreSQL externo e endpoint de saúde.

## Riscos e controles

| Risco | Controle de plano |
|---|---|
| Perda de dados criptografados | Inventário da chave antes da exportação; validação de descriptografia em staging; nunca gerar chave substituta silenciosamente. |
| Políticas de acesso expõem dados entre usuários | RLS testada por papel e por usuário antes de qualquer dado real. |
| Coletas duplicadas ou sobrepostas | Jobs idempotentes com trava por execução e registro de última coleta. |
| Divergência entre painel novo e atual | Modo sombra e matriz de paridade por rota, dado e interação. |
| Deploy irreversível | Preview Vercel, ambiente Supabase separado e rollback documentado antes da promoção. |
| Limite gratuito interrompe a operação | Monitorar consumo, pausas e limites; não prometer disponibilidade idêntica à de um processo persistente. |

## Provisionamento confirmado em 2026-09-01

- Repositório oficial: `https://github.com/eduardomourao/Token`, branch `main`, sincronizado até `5c0f1ef` antes das alterações locais de ignore da Vercel.
- Supabase isolado: `mtokqhqdkkxbyvgjwyvu`, organização `tokens`, região `sa-east-1`. Está vazio além de `app.migration_metadata`; a migração remota e local estão alinhadas e o advisor remoto não apontou problemas.
- Projeto Supabase existente `lzsaaufsdcmqlasjrqck` é um CRM com dados reais e fica fora de todo comando, migração e validação desta tarefa.
- Projeto Vercel: `token-usage-monitor`, vinculado ao time `stiflerwfl1-oss-projects`. Um deploy local inicial foi interrompido antes do término quando a CLI estimou upload de 557 MB, causado por superfícies locais não excluídas.
- O `.vercelignore` local exclui ambientes, dependências, artefatos, testes, documentação, `deploy/` e a árvore Git. A próxima validação deve provar que o upload ficou pequeno antes de declarar preview disponível.
- A primeira estimativa de 520 MB foi reproduzida: `.code-review-graph/graph.db` local respondia por aproximadamente 514 MiB. A pasta foi adicionada ao `.vercelignore`; sem ela, a árvore elegível é aproximadamente 12 MiB.
- Deploy Vercel confirmado: `dpl_91JRoMc9uAfcL7scFqj4m5roNbMC`, estado `READY`, URL `https://token-usage-monitor.vercel.app`. O build remoto instalou dependências e concluiu `tsc -b && vite build`. A Vercel classificou-o como produção automaticamente porque era o primeiro deploy do projeto.

## Inventário para o Dashboard hospedado

- A fonte local ativa é `C:\Users\Admin\.codex-lb\store.db` (6.979.584 bytes), lida exclusivamente no modo SQLite read-only. Há backups pré-migração separados no mesmo diretório.
- A base tem 5 contas, 5.314 leituras de `usage_history`, 305 leituras de `additional_usage_history`, 127 decisões de quota e nenhum log de requisição, chave de API, automação, sessão HTTP bridge ou configuração de proxy ativa.
- Credenciais OAuth das contas ficam nos campos criptografados de `accounts`; o primeiro modelo hospedado não os copia para o Supabase e não habilita ações que alterem routing. Ele transporta somente metadados de leitura e históricos de quota sob RLS do proprietário.
- Próximo slice: Dashboard de leitura autenticado pelo Supabase, com resposta compatível para contas e quotas. Logs de requisição, automações, chaves e proxy permanecem fora desse slice porque não existem dados ativos ou dependem do runtime persistente.
