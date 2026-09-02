# Task Plan: OpenCode Go usage monitor

## Goal

Add a secure, non-routing OpenCode Go limit monitor with persisted history, CSV export, dashboard card, and settings controls.

## Current Phase

Phase 17 — Hosted Vercel/Supabase production hardening

## Phases

### Phase 1: Contracts and discovery

- [x] Confirm source API payload and application integration points.
- [x] Configure local Matt tracker and domain vocabulary.
- [x] Create OpenSpec change and define public test seams.
- **Status:** complete

### Phase 2: Backend persistence and ingestion

- [x] Add models, migration, client, service, API, scheduler, and retention.
- [x] Add focused backend tests using public service/API seams.
- **Status:** complete

### Phase 3: Dashboard controls

- [x] Add typed client, dashboard card, settings section, i18n, and frontend tests.
- **Status:** complete

### Phase 4: Verification and review

- [x] Run OpenSpec, focused tests, type checks, lint, and build.
- [ ] Run Matt Standards/Spec review and code-review graph workflow (blocked: no `.git` fixed point/graph root).
- **Status:** in_progress

### Phase 5: Mobile usage monitor contracts and seams

- [x] Confirm standalone route boundary, existing account/overview/OpenCode queries, charts, theme store, and navigation conventions.
- [x] Create the OpenSpec change and record the public UI/data seams.
- [x] Add RED tests for the standalone route, selection persistence, account/OpenCode states, refresh behavior, and wake lock lifecycle.
- **Status:** complete

### Phase 6: Mobile monitor implementation

- [x] Add isolated feature components, Zod selection schema, 60-second queries, screen wake lock, and translations.
- [x] Wire lazy route and core navigation without changing the existing dashboard feature.
- **Status:** complete

### Phase 7: Validation and review

- [x] Run scoped tests, type checks, lint, build, and strict OpenSpec validation.
- [ ] Run Hallmark pre-emit checks and required Matt/code-review-graph review workflows. (Hallmark static gate pass recorded; browser-width proof is unavailable in this session. Matt review needs a git fixed point and code-review-graph rejects this extracted tree because it has neither `.git` nor `.code-review-graph`.)
- **Status:** in_progress

### Phase 8: PWA contracts and dependency setup

- [x] Confirm Vite output, existing icon, SPA entry point, and `/usage-monitor` route boundary.
- [x] Create OpenSpec change and define PWA install/update public seams.
- [x] Install PWA/icon tooling with Bun and add RED tests for progressive prompts.
- **Status:** complete

### Phase 9: PWA implementation

- [x] Configure generated manifest, service worker, app-shell/API caching, and icon pipeline without changing the static output path.
- [x] Add progressive update toast and install banner to the monitor route.
- **Status:** complete

### Phase 10: PWA validation and review

- [x] Generate icons; build and inspect manifest/service-worker output; run relevant test, type, lint, and OpenSpec checks.
- [ ] Run Hallmark static review plus required Matt/code-review-graph reviews. (Hallmark static design check recorded; browser-device proof and VCS-based review are unavailable in this extracted checkout.)
- **Status:** in_progress

### Phase 11: Landscape kiosk contracts and tests

- [x] Confirm existing monitor/PWA contracts and compact Galaxy J8 viewport constraints.
- [x] Record direct Matt implementation route, Hallmark component-scope decisions, OpenSpec change, and public test seams.
- [x] Add RED tests for swipe, landscape gate, persisted indexed selection, and exactly two panels.
- **Status:** complete

### Phase 12: Landscape kiosk implementation

- [x] Add touch carousel/index selection, supported orientation lifecycle, gate, compact header, and dots.
- [x] Convert account/OpenCode dashboards to fixed Daily/Weekly panels and compact used-percent donuts.
- [x] Remove trends/overview requests, install banner, seconds, and unused sparkline wrapper.
- **Status:** complete

### Phase 13: Landscape kiosk validation and review

- [ ] Run required frontend/OpenSpec checks and inspect the regenerated PWA manifest. (Focused checks and artifact inspection pass; default and serialized full Vitest runs both exceed bounded waits.)
- [x] Record Hallmark static result plus formal-review blockers.
- **Status:** in_progress

### Phase 14: Gemini and Antigravity monitor discovery

- [x] Read the supplied Gemini, Antigravity, and shared collector implementations and confirm their external API/authentication contracts.
- [x] Compare the existing OpenCode Go monitor's encrypted singleton, samples, scheduler, API, retention, and frontend monitor seams.
- [x] Create the OpenSpec contract and RED tests for both providers before implementation.
- **Status:** complete

### Phase 15: Gemini and Antigravity monitor implementation

- [x] Add encrypted monitor persistence, migrations, async OAuth/API clients, services, APIs, scheduler registration, and retention integration.
- [x] Add typed frontend APIs, carousel selections, and two-panel provider dashboards without changing existing account/OpenCode behavior.
- **Status:** complete

### Phase 16: Gemini and Antigravity validation and review

- [x] Run focused backend/frontend/migration checks, strict OpenSpec validation, and live route verification through the authenticated integration app. (Full `uv run pytest` exceeded bounded waits with no output; focused suites pass.)
- [x] Record Hallmark and formal review results/blockers.
- **Status:** complete

### Phase 17: Hosted Vercel/Supabase production hardening

- [x] Preserve Vercel/Supabase-only read-model boundary and deploy staged WebSocket relay compatibility.
- [x] Push hosted changes to GitHub and verify production health plus controlled native response/cancellation flows.
- [x] Resolve locally reproducible GitHub Actions lint/type failures; focused Python regressions now pass (43 passed, 2 Windows-only POSIX skips).
- [ ] Push the CI hardening commit and verify the new GitHub Actions run, including the PostgreSQL migration job.
- [ ] Run 740 x 360 landscape device/browser proof; explicitly retain any advanced WebSocket-parity limitation.
- **Status:** in_progress

## Public test seams

- Backend HTTP client parser for the OpenCode Go usage payload.
- Authenticated monitor REST API and CSV download.
- Scheduler's leader-gated refresh entry point and retention pass.
- Dashboard and settings React components through their typed API hooks.
- Standalone `/usage-monitor` route, its persisted selector, and its account/OpenCode render states.
- Existing authenticated frontend APIs: `listAccounts`, `getDashboardOverview`, and `getOpenCodeGoUsageMonitor`.
- Browser `beforeinstallprompt` / `appinstalled` events and PWA update registration hook.
- Generated manifest, service worker, and icon files in `app/static` after the frontend build.

## Decisions

| Decision | Rationale |
|---|---|
| Singleton monitor, not an Account or ModelSource | OpenCode Go limits must not affect proxy routing. |
| One sample per rolling/weekly/monthly window | Matches upstream payload and makes CSV rows simple. |
| 120-second leader-gated refresh | Matches source project cache cadence and multi-replica policy. |
| 90-day fixed retention | User-selected bound without a new settings surface. |
| CSV-only history UI | User-selected export format; charts out of scope. |
| Mobile monitor uses a standalone route | The always-on phone surface must not inherit app header, status bar, or page-width limits. |
| Usage trend uses existing overview data | The feature must reuse the existing overview API and does not change its dashboard contract. |
| pt-BR is additive with English fallback | The requested Portuguese monitor/nav copy is available without translating unrelated existing settings. |
| PWA starts on `/usage-monitor` | Installed kiosk launches directly into the dedicated always-on surface. |
| PWA uses progressive prompts | Desktop and unsupported mobile browsers retain normal SPA behavior. |
| Landscape kiosk keeps exactly two slots | Daily and Weekly must fit side-by-side within the Galaxy J8 always-on viewport. |
| Carousel stores a selection index | Swipe and selector navigation use one ordered list and persist the same selected source. |

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| PowerShell glob passed to rg was invalid | 1 | Use rg include filters or literal paths. |
| Patch targeted outer ZIP directory | 1 | Prefix all patch paths with `codex-lb-main/`. |
| `openspec` was absent from PATH | 1 | Ran the official ephemeral `npx @fission-ai/openspec@1.11.0` CLI. |
| Matt/diff and code-review-graph need a VCS root | 1 | Checkout is extracted without `.git`; reported as a formal review blocker. |
| Local server absent after build check | 1 | Restarted `uv run codex-lb`; `/usage-monitor` now returns HTTP 200 on port 2455. |
| Backend Ruff invoked from `frontend/` | 1 | The relative backend paths were absent; reran the identical check from the project root successfully. |
| Phase-17 plan patch used stale context | 1 | Retargeted the patch to the current task-plan anchors. |
| Repository lint/type gates failed | 1 | Fixed mechanical Ruff findings, typed monitor client seams structurally, made smoke cleanup portable, and retained POSIX fork coverage only where supported. |
