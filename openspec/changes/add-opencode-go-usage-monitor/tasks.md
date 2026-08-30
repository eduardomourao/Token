## 1. Persistence and ingestion

- [x] 1.1 Add singleton configuration and usage-sample schema plus Alembic migration.
- [x] 1.2 Add validated upstream client, encrypted credential handling, service, scheduler, and retention.
- [x] 1.3 Add authenticated monitor, refresh, configuration, removal, and CSV APIs.

## 2. Dashboard

- [x] 2.1 Add typed frontend monitor client and queries.
- [x] 2.2 Add dashboard card and settings controls with localized empty, loading, stale, and error states.
- [x] 2.3 Add CSV download action.

## 3. Verification

- [x] 3.1 Add backend unit/integration/migration tests.
- [x] 3.2 Add frontend unit/integration tests.
- [ ] 3.3 Run OpenSpec validation, focused suites, type checks, lint, build, and required reviews. (Scoped OpenSpec and all relevant executable code gates passed; the full spec tree has one unrelated `model-source-routing` failure. The mandated diff/graph reviews remain blocked because this extracted workspace has no `.git` and code-review-graph cannot create a graph without a VCS root.)
