## 1. Contracts and tests

- [x] 1.1 Define the landscape kiosk, swipe, and two-panel behavior in OpenSpec and planning records.
- [x] 1.2 Add RED tests for horizontal swipe detection, portrait gating, ordered persisted selection, and two-panel rendering.

## 2. Landscape kiosk implementation

- [x] 2.1 Set orientation-neutral manifest metadata and add supported landscape lock/unlock lifecycle.
- [x] 2.2 Add swipe hook, ordered index selection, compact selector, slide transition, and carousel dots.
- [x] 2.3 Reduce Account and OpenCode Go dashboards to Daily and Weekly panels with compact usage-colored donuts and placeholders.
- [x] 2.4 Remove monitor sparkline code, overview polling, kiosk install banner, and seconds from the clock.

## 3. Verification

- [ ] 3.1 Run focused and full frontend tests, typecheck, lint, production build, and inspect generated manifest. (Focused 16-test suite, typecheck, lint, build, generated manifest, and live HTTP checks pass; the default forked and a serialized threaded full Vitest invocation both exceeded repeated bounded waits without a result.)
- [x] 3.2 Validate OpenSpec and record Hallmark/Matt/code-review-graph review results.
