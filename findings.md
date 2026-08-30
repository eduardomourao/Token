# Findings & Decisions

## Requirements

- One encrypted OpenCode Go key per installation.
- Read current rolling, weekly, and monthly limits from the upstream API.
- Store history for 90 days and export CSV.
- Show a dashboard card and a settings control; never route through this monitor.

## Research Findings

- Source extractor calls `GET https://opencode.ai/zen/go/v1/usage` with `Authorization: Bearer <key>`.
- Payload uses `usage.{rolling,weekly,monthly}.{status,percent,resetsAt}`; `percent` is available capacity.
- codex-lb already has TokenEncryptor, leader election, background DB sessions, Alembic, and hourly retention.
- The checkout has no `.git` directory. Local Markdown is the configured Matt tracker for this extracted workspace.

## Design Findings

- Hallmark component scope: preserve Geist Sans / JetBrains Mono, existing OKLCH token palette, Tailwind/shadcn components, and low-motion stance.
- UI is additive inside existing Dashboard and Settings pages; no redesign, new route, invented metrics, or custom palette.

## Technical Decisions

| Decision | Rationale |
|---|---|
| Keep last successful reading on refresh error | Prevent external API failures from erasing operator data. |
| Validate key before replacing stored credential | Invalid replacements cannot break a working monitor. |
| Store sanitized error class only | Avoid leaking remote response data or credentials. |
| Keep `/usage-monitor` outside `AppLayout` | Full-screen monitoring must omit global app chrome and width constraints. |
| Force dark using the existing theme store | Keeps document class and persisted theme behavior aligned with the application. |
| Do not add a new backend endpoint | The page reuses the existing accounts, dashboard overview, and OpenCode Go monitor APIs. |

## Mobile Usage Monitor Findings

- The existing dashboard overview endpoint accepts `1d` and `7d` timeframes and returns account window membership plus aggregate token/request trends. It does not expose per-account trend series, so this display uses the requested selected-account window lookup and existing timeframe trend data without changing the dashboard API contract.
- `AccountSummary` already carries the primary, secondary, optional monthly capacity/remaining/reset fields and request totals required by the monitor.
- The OpenCode Go monitor already exposes `configured`, `lastSuccessAt`, `lastError`, and typed rolling/weekly/monthly windows.
- The current locale registry supports en, ko, and zh-CN only. The requested Portuguese navigation string requires a small pt-BR resource with English fallback for existing keys.

## Mobile Usage Monitor Verification Review

- Static Standards check: the feature is isolated under `features/usage-monitor`, reuses the established typed APIs and chart primitives, stores only a Zod-validated selector string, and keeps the existing dashboard feature unmodified. The wake-lock request is capability-gated and released on unmount; all new visible copy is localized.
- Static Spec check: the route is lazy and outside `AppLayout`; it renders a compact selector and live clock, persists a single source, polls source data at 60 seconds, renders normal-account/OpenCode Go paths, forces dark while mounted, and avoids request logs/settings/tables.
- OpenSpec scoped strict validation passed. Full validation remains blocked by the unrelated existing `model-source-routing` spec failure.
- Hallmark static pre-emit: P5/H5/E4/S5/R4/V5. The page uses a monitor-console structure, semantic dark gradient, existing rounded UI/chart primitives, no fabricated metrics, no redrawn device chrome, and a reduced-motion-safe pulse. Desktop/mobile visual proof at 320/375/414/768 px was not run because no Chrome automation session was available.
- Formal Matt Standards/Spec and code-review-graph reviews are blocked because the extracted checkout has no `.git` fixed point or graph root. The graph tool returned: `repo_root does not look like a project root (no .git, .svn, or .code-review-graph directory found)`.

## PWA Findings

- The Vite build already emits to `app/static`, so vite-plugin-pwa can generate the manifest and service worker beside the Python-served SPA without changing the serving contract.
- `registerType: "autoUpdate"` supplies the normal registration; the React virtual module is only needed to present an explicit user-controlled refresh toast.
- The browser install prompt is optional and must be event/capability driven. Its dismissal remains local to the browser and must never affect desktop rendering or ordinary navigation.
- Existing icon source is `frontend/public/favicon.svg`; sharp can render square dark-background PNG variants for Chromium and iOS.

## PWA Implementation Decisions

| Decision | Rationale |
|---|---|
| Use the generated service worker, not a hand-maintained worker | Keeps Vite asset revisions and Python-served output aligned automatically. |
| Import `useRegisterSW` only for update feedback | `registerType: autoUpdate` owns registration while the UI retains a visible, user-controlled update action. |
| Keep install prompting only on `/usage-monitor` | It is the designated kiosk surface; normal desktop pages are not interrupted. |
| Persist only install-banner dismissal | The browser owns install eligibility and installed state; local storage avoids repetitive UI without storing sensitive data. |
| Re-render the existing SVG as white-on-zinc PNGs | Chromium, maskable, and iOS icons are consistent with the requested kiosk dark theme. |

## PWA Validation Findings

- `vite-plugin-pwa` generated `manifest.webmanifest`, `sw.js`, and its Workbox runtime under `app/static`; the static build path and Python serving contract remain unchanged.
- The generated service worker precaches app-shell assets, including the generated PWA icons, and registers the requested NetworkFirst cache for GET `/api/*` with a 10-second network timeout, a maximum of 50 entries, and a five-minute age limit.
- The running backend serves the route, manifest, worker, and image assets from root paths with HTTP 200 and expected content types.
- Fullscreen behavior, portrait orientation, and start route are manifest-declared. Real home-screen installation behavior remains a browser/device acceptance check, not a static-build claim.

## PWA Review Gate Record

| Axis | Findings | Relevant coverage | Recommendation |
|---|---|---|---|
| Standards (static fallback) | No hard issue found: the implementation preserves the Vite build output/manual chunks, uses typed PWA declarations, shadcn controls, localized visible copy, and focused components. | Full Vitest suite; prompt-focused tests; typecheck; ESLint; production build. | Accept the static result; run the required diff-based Matt review when a Git fixed point is available. |
| Spec (static fallback) | No missing implementation found in the generated manifest/worker, icon assets, progressive update/install controls, or root-served artifact checks. Device-only install/fullscreen behavior is intentionally unverified. | Strict `add-mobile-pwa-kiosk` OpenSpec validation plus live HTTP artifact checks. | Accept for local testing; complete phone installation verification before release. |
| code-review-graph | Blocked: the graph skill is not installed in the current profile, and the extracted source has no `.git`, `.svn`, or existing graph root. | Not executable. | Re-run `build-graph` and a scope-appropriate graph review after restoring repository metadata and installing the required skill. |

## Landscape Kiosk Findings

- The existing mobile monitor can be narrowed without backend changes: account summaries already expose primary/secondary limits and OpenCode Go already exposes rolling/weekly windows.
- Removing trend cards makes `getDashboardOverview` unnecessary on this route; no existing dashboard API contract needs to change.
- The shared donut requires an additive compact rendering mode to honor a real 120px chart rather than visually scaling a 152px card and wasting vertical space.
- Hallmark component-scope decision: preserve existing semantic colors, Geist typography, Tailwind/shadcn interactions, and reduced-motion behavior. Use the requested solid dark kiosk canvas; no fake device frame or invented telemetry.
- Matt route: direct `implement` with TDD, because the user supplied a bounded, executable single-session specification and tracker setup already exists. Public seams: touch handlers, orientation gate, rendered monitor route, persisted selection, compact panel values, and generated manifest.

## Verification Review

- Static Standards check: the implementation keeps monitor code isolated from `Account` and `ModelSource` routing; encrypted credentials stay server-only; API response schemas have no credential field; external failures preserve successful samples.
- Static Spec check: the new monitor follows the requested three windows, 120-second leader-gated refresh, 90-day retained export history, authenticated read/write separation, audit actions, and dashboard/settings scope without adding charts or navigation.
- Formal Matt Standards/Spec diff review is blocked because this source extraction has no `.git` repository or fixed point.
- Formal `code-review-graph` review is blocked: it refused to build a graph without `.git`, `.svn`, or an existing `.code-review-graph` root.
- Full OpenSpec validation has one unrelated existing failure in `model-source-routing`, which lacks the required `## Purpose` section. The scoped OpenCode Go change validates strictly.

## Landscape Kiosk Implementation Decisions

| Decision | Rationale |
|---|---|
| Keep the existing selector value as the durable storage format while navigating by an active index | The persisted Zod-backed selection contract remains backwards compatible; the index is recalculated against the live ordered account list. |
| Use a 50px, horizontal-dominant touch threshold | It permits deliberate account changes without hijacking vertical gestures. |
| Gate portrait rendering and use a best-effort orientation lock | Installed and regular-browser use both retain a safe fallback when the Screen Orientation API is unavailable or denied. |
| Add `compact` to the existing DonutChart | The 120px kiosk card fits the 740x360 target while leaving all default dashboard rendering unchanged. |
| Use used percent as the dominant visual number | The new kiosk communicates consumption urgency directly; remaining capacity remains available as secondary context. |

## Landscape Kiosk Validation and Review

- Focused frontend coverage passed: 16 tests across swipe, landscape gate, monitor states and persistence, usage-color mapping, and existing PWA prompts.
- TypeScript typecheck, ESLint, production build, and strict scoped OpenSpec validation passed. The generated and live-served PWA manifest declares `orientation: "any"` and `start_url: "/usage-monitor"`; `/usage-monitor` returned HTTP 200 from the Python backend.
- An unfiltered `bun run test` was attempted twice after resolving virtual PWA registration for tests, but Vitest left its fork worker process running without producing a final suite result. A serialized threaded run advanced with CPU activity but exceeded repeated bounded waits without a result as well. Only explicitly identified current-run test processes were stopped; do not treat the full suite as passed.
- Hallmark static pre-emit review: P5/H5/E5/S5/R5/V4. The refactor preserves the existing visual system and shadcn primitives, uses the requested solid `#09090b` canvas and compact 28px/22px rails, and creates no fake device framing. A real 740x360 browser/device render remains unexecuted.
- Matt Standards/Spec and `code-review-graph` are formal blockers: no Git fixed point exists in this extraction, and the graph tool/package/root is unavailable. Static Standards/Spec fallback found no scope violation: existing dashboard behavior remains untouched, monitor APIs stay typed, and the compact chart mode is additive.

## Gemini and Antigravity Monitor Discovery

- Gemini reference behavior: exchange a refresh token at `https://oauth2.googleapis.com/token`, then call `loadCodeAssist` with Gemini CLI metadata and `retrieveUserQuota` with the resolved Cloud project. Latest-track selection prefers REQUESTS buckets and maps `remainingFraction` plus `resetTime` into Pro, Flash, and Flash-Lite windows.
- Antigravity reference behavior: refresh Cockpit/`agy` credentials through the same token endpoint, call `https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels` using `antigravity/1.15.8 linux/amd64`, group model quota by Gemini versus Claude+GPT, take the lowest remaining fraction and earliest reset in each group, and infer 5-hour/weekly cycles from reset distance.
- Codex LB already establishes the required safe seam: encrypted singleton credential, sanitized upstream errors, last-success sample preservation, leader-elected background scheduler, authenticated write API, and shared retention job. New providers should follow it rather than reusing account/model routing state.
- OAuth client resolution must use the requested `CODEX_LB_*` environment keys first, then configured local values, then installed CLI/Cockpit discovery. No discovered credential or refresh token may be returned by APIs, logged, audited, or included in errors.

## Gemini and Antigravity Implementation Review

- Added independent encrypted singleton credentials and historical samples. The new Alembic revision upgrades from the OpenCode Go head and downgrades cleanly in focused migration coverage.
- Gemini uses the exact Gemini CLI metadata, reads the Cloud project from `loadCodeAssist`, and selects the known Latest-model preference order using REQUESTS-preferred buckets. Antigravity uses the documented endpoint/user agent and conservatively collapses matching models using the lowest remaining fraction and earliest reset.
- Both refresh flows receive a fresh OAuth access token from the stored refresh token per collection. OAuth clients resolve from the requested `CODEX_LB_GEMINI_*`/`CODEX_LB_ANTIGRAVITY_*` environment variables, optional local JSON configuration, or installed Gemini/agy/Cockpit discovery; no client secret is sent to the frontend.
- Hallmark component-scope result: P5/H5/E5/S5/R5/V4. New monitor panels reuse existing compact donut cards, the solid dark landscape canvas, existing typography/tokens, and the fixed two-panel hierarchy; no new visual system or fake chrome.
- Static Standards/Spec fallback found the provider monitors isolated from proxy routing. Formal Matt Standards/Spec and `code-review-graph` remain blocked because the extracted checkout has no Git fixed point and no graph-root/installed graph skill.
- The local server required a controlled restart because the existing process was serving the pre-change application image. After restart, `GET /api/gemini-usage/` and `GET /api/antigravity-usage/` both resolve through the local FastAPI application (HTTP 200 in its authenticated dashboard mode).
- Full-suite gate remains blocked: `uv run pytest -q` produced no progress output and stayed idle beyond bounded waits, so its explicitly identified process chain was stopped. The focused six-test provider suite and existing focused OpenCode Go suite passed; do not interpret this as a full Python-suite pass. The previously recorded full Vitest runner issue remains unresolved.
