# Plano: migração para GitHub, Vercel e Supabase

## Objetivo

Adaptar o produto para operar com GitHub, Vercel e Supabase, preservando a experiência do painel e de monitoramento sem publicar nem descartar o runtime atual antes de uma validação de paridade e rollback.

## Estado atual

Fase 1 — descoberta, backup e definição de escopo.

## Fases

### Fase 1: backup e inventário

- [x] Criar snapshot externo verificável do código, documentação, configuração e artefatos gerados.
- [x] Registrar que o arquivo compactado inicial foi truncado e não é um backup válido.
- [x] Identificar os processos persistentes, schedulers e WebSockets do runtime atual.
- **Status:** concluída

### Fase 2: contrato de migração

- [x] Separar contratos que podem migrar para Vercel/Supabase dos que exigem redesenho.
- [x] Decidir explicitamente o destino do proxy OpenAI/WebSocket: verticais em Supabase Edge Function, começando por Responses HTTP/SSE.
- [x] Definir o contrato de autenticação, propriedade dos dados, criptografia e RLS para Dashboard e primeiro vertical de Responses.
- [x] Registrar a especificação e os tickets verticais antes de cada alteração estrutural.
- **Status:** em andamento

### Fase 3: fundação Vercel e Supabase

- [x] Inicializar o repositório versionado a partir do snapshot validado, sem sobrescrever o remoto atual.
- [x] Criar a fundação local do Supabase: configuração neutra, esquema privado e RLS sem acesso de navegador.
- [ ] Ensaiar a migração local do Supabase quando o Docker Desktop estiver disponível.
- [x] Criar ambiente Supabase isolado, segredos e migrações versionadas.
- [x] Criar preview e produção da Vercel com deploy verificável.
- [x] Implementar o validador estático de contratos de rotas e interações do monitor.
- [x] Implementar fluxos verticais de Dashboard/Usage Monitor e Responses HTTP/SSE com testes focados e validação remota de acesso.
- **Status:** em andamento

### Fase 4: adaptação por fluxos verticais

- [x] Migrar autenticação e sessão do Dashboard/Usage Monitor.
- [x] Migrar contas, limites, históricos e Dashboard em modelo de leitura proprietário.
- [x] Converter coletores curtos em Cron + Edge Functions e publicar as leituras no Supabase.
- [ ] Tratar separadamente fluxos que dependem de conexão persistente, streaming ou WebSocket; a vertical HTTP/SSE inicial está em execução.
- [x] Entregar Dashboard hospedado de leitura com contas e históricos de quota sem credenciais de routing.
- **Status:** em andamento

### Fase 5: migração de dados e execução paralela

- [x] Exportar dados de origem em modo SQLite read-only, sem alterar a chave local nem os arquivos auxiliares.
- [x] Importar o modelo de leitura e as credenciais privadas com contagens de paridade verificadas.
- [ ] Executar em modo sombra, sem gravar em produção pelo novo caminho.
- [ ] Ensaiar rollback com o snapshot e o runtime atual.
- **Status:** pendente

### Fase 6: corte controlado

- [ ] Congelar gravações no runtime antigo apenas durante a janela de corte aprovada.
- [ ] Repetir exportação incremental, promover as migrações e publicar a versão aprovada.
- [ ] Validar autenticação, monitoramento, atualização automática, logs e fluxos críticos.
- [ ] Manter rollback disponível até o período de estabilidade acordado.
- **Status:** pendente

## Decisões já tomadas

| Decisão | Motivo |
|---|---|
| GitHub será a fonte oficial do código | Permite histórico, revisão, CI e integração com deploy. |
| Vercel hospedará frontend e operações curtas sob demanda | Adequado para aplicação web e APIs stateless. |
| Supabase hospedará PostgreSQL, Auth, Realtime e Cron | Centraliza dados, sessão e atualizações programadas. |
| Atualizações de uso iniciarão com cadência de 1 minuto | Mantém boa atualização percebida sem depender de servidor contínuo. |
| O runtime atual permanece referência até a paridade ser demonstrada | Evita perda de dados ou corte sem rollback. |

## Escopo restante do proxy

O primeiro vertical hospedado cobre somente `POST /v1/responses` autenticado, resposta JSON concluída e SSE. WebSocket, replay/resume, afinidade, failover, seleção de Account equivalente ao runtime atual, API keys, arquivos, imagens, áudio, model sources e as demais rotas ainda exigem tickets próprios com testes de compatibilidade. O runtime FastAPI e o snapshot externo permanecem o rollback desses contratos.

## Retomada em 2026-09-01

- O fluxo inicial fica limitado ao Usage Monitor e ao projeto Supabase isolado `mtokqhqdkkxbyvgjwyvu`; o CRM `lzsaaufsdcmqlasjrqck` está fora do escopo.
- A fundação remota foi aplicada e o advisor do projeto isolado não reportou problemas.
- O projeto Vercel `token-usage-monitor` foi criado, mas não há preview concluído: o primeiro upload foi interrompido antes de gerar URL, pois incluiu 557 MB de dependências locais.
- A `.vercelignore` local foi criada para reduzir o pacote. Três frentes paralelas, somente de análise, foram iniciadas para Vercel, Supabase e contrato do monitor.
- O segundo deploy passou após excluir o banco local de grafo: `dpl_91JRoMc9uAfcL7scFqj4m5roNbMC` está READY. Por ser o primeiro do projeto, a Vercel o atribuiu automaticamente ao alvo de produção; o monitor ainda não é funcional sem o fluxo vertical Supabase.
- O fluxo vertical Gemini agora possui usuário proprietário, Edge Function publicada, credenciais em segredos e transações de coleta idempotentes. A primeira coleta falhou de forma sanitizada porque o upstream `retrieveUserQuota` devolve HTTP 403 após OAuth válido; não promover enquanto esse acesso não for restaurado.
