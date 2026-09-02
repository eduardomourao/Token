# 07 — Dashboard hospedado de leitura

**What to build:** um Dashboard autenticado pelo Supabase que mostra as contas e os históricos de quota já existentes, sem expor tokens OAuth nem habilitar operações que dependem do proxy persistente.

**Blocked by:** 05 — Primeiro fluxo vertical: monitor de uso.

**Status:** implemented

- [x] O Supabase mantém metadados não secretos de contas e históricos de quota com isolamento por proprietário.
- [x] Um importador read-only compara e importa a fonte SQLite sem copiar campos criptografados.
- [x] O Dashboard hospedado mostra dados do proprietário e comunica claramente que ações de routing continuam no runtime legado.
- [x] Testes comprovam RLS, contrato de importação e o comportamento do Dashboard hospedado.

## Evidência — 2026-09-02

- `tests/unit/test_hosted_dashboard_read_model.py` e os contratos adjacentes
  do proxy aprovaram 13 testes: ownership, RLS, imports sem ciphertext e
  sequências de histórico da projeção hospedada.
- `frontend/src/features/dashboard/hosted-dashboard-read-model.test.ts`
  aprovou dois testes para selecionar a amostra mais recente por janela e
  assinar/remover a inscrição Realtime sem vazar canal.
- A prova cobre o read model hospedado e seu isolamento; ela não declara que
  as operações de routing do processo legado estejam disponíveis no browser.
