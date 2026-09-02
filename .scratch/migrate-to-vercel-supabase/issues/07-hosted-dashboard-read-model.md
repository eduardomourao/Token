# 07 — Dashboard hospedado de leitura

**What to build:** um Dashboard autenticado pelo Supabase que mostra as contas e os históricos de quota já existentes, sem expor tokens OAuth nem habilitar operações que dependem do proxy persistente.

**Blocked by:** 05 — Primeiro fluxo vertical: monitor de uso.

**Status:** ready-for-agent

- [x] O Supabase mantém metadados não secretos de contas e históricos de quota com isolamento por proprietário.
- [x] Um importador read-only compara e importa a fonte SQLite sem copiar campos criptografados.
- [x] O Dashboard hospedado mostra dados do proprietário e comunica claramente que ações de routing continuam no runtime legado.
- [ ] Testes comprovam RLS, contrato de importação e o comportamento do Dashboard hospedado.
