# 01 — Linha de base Git e CI de migração

**What to build:** uma linha de base versionada localmente e uma validação de CI que execute checks existentes do frontend e do backend sem efetuar deploy, push ou usar segredos.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] O repositório local possui histórico inicial preservando o snapshot verificado como ponto de retorno.
- [ ] A configuração de CI é explícita sobre comandos, artefatos e ausência de credenciais de deploy.
- [ ] Os checks escolhidos podem executar em pull requests sem publicar recursos externos.
