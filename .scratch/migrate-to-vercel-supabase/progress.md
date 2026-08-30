# Progresso: migração para GitHub, Vercel e Supabase

## 2026-08-29 — descoberta e proteção do estado atual

- Backup integral compactado: tentativa encerrada com arquivo truncado; o arquivo foi mantido apenas como evidência e não é válido.
- Backup alternativo: snapshot externo da árvore de fonte/configuração criado com sucesso.
- Verificação: 4.507 arquivos, 45.776.220 bytes e hashes críticos idênticos à origem.
- Descoberta: o runtime atual contém backend FastAPI persistente, WebSockets, streaming, cache, eleição de líder e múltiplos schedulers. A adaptação para Vercel + Supabase exigirá conversão de fluxos e não pode ser tratada como deploy direto do Docker existente.
- Subagentes: cinco frentes de investigação foram solicitadas, mas todas foram encerradas pelo limite de uso antes de entregar resultados. A análise local continua; reenviar sem renovação da cota repetiria o mesmo erro.
- Planejamento: uma primeira tentativa de criar a especificação e os tickets falhou por formatação de patch. Nenhum arquivo foi gravado nessa tentativa; o conteúdo foi reaplicado em patch menor com sucesso.
- Git local: repositório inicializado e remoto `eduardomourao/Token` configurado apenas localmente. O commit-base está pendente: a identidade Git possui e-mail de exemplo e `git diff --cached --check` reporta whitespace pré-existente em documentação importada, incluindo arquivos fora do escopo desta migração. Nenhum push foi realizado.
- Alterações na aplicação: nenhuma.
- Alterações externas: nenhuma. Não houve push, deploy, criação de projeto, migração de banco ou modificação do repositório remoto.

## 2026-08-30 — início da fundação local

- Base Supabase criada apenas em `supabase/`: configuração local sem referência remota, schema privado `app`, tabela de metadados de migração e RLS forçado sem política para navegador. Nenhum dado, URL, chave ou projeto Supabase foi criado.
- Validação estática da base Supabase: TOML e invariantes de SQL aprovados. Ensaio local do Supabase permanece pendente porque o daemon Linux do Docker Desktop está desligado; nenhum atalho por banco remoto foi usado.
- Git local: o índice que havia sido preenchido durante a tentativa de baseline foi limpo com `git reset` sem apagar ou alterar arquivos. Ainda não há commit nem push.
- Frentes paralelas em andamento: workflow seguro de validação no GitHub Actions, base de preview estático da Vercel e validador de contratos de rota/comportamento. As três possuem escopos de arquivo isolados e não publicam nada.
- Revisão obrigatória: a tentativa inicial de construir o grafo `code-review-graph` encontrou o bloqueio SQLite `database is locked`. Nenhum arquivo do grafo foi removido ou sobrescrito; a construção e a revisão formal serão repetidas após encerrar as escritas paralelas.
- Entregas integradas: `vercel.json` e `deploy/vercel/` configuram somente a prévia estática Vite e excluem os prefixos do backend do fallback SPA; `.github/workflows/migration-foundation.yml` valida artefatos locais em PR/manual sem segredos, deploy ou banco remoto; `scripts/migration/contract_inventory.py` fixa os contratos críticos de rota e interação.
- Validações locais aprovadas: validador de Vercel, inventário de contratos, 6 testes focados e Ruff dos novos scripts/testes.
- Revisão por grafo: atualização incremental voltou a funcionar, porém reconstrução completa com fontes não rastreadas ultrapassou a janela segura e foi interrompida. Como ainda não há commit-base local, a análise de diff/impacto do `code-review-graph` permanece formalmente bloqueada; não deve ser considerada concluída.
- Revisão Matt Standards/Spec: o fluxo exige um commit, branch, tag ou merge-base que resolva e um diff contra `HEAD`. Este checkout não possui commit inicial e a identidade Git atual usa um e-mail de exemplo; a revisão fica bloqueada até definir identidade e criar um baseline local deliberado. Não foi criado commit com identidade inventada.
- Alterações externas: nenhuma. A configuração de GitHub, Vercel e Supabase continua inteiramente local e sem credenciais.
