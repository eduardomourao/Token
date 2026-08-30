## 1. Contracts and tests

- [x] 1.1 Define the standalone route, source APIs, selection persistence, data states, and wake-lock behavior in OpenSpec.
- [x] 1.2 Add RED tests for selector options/persistence, account and OpenCode dashboards, route isolation, polling, and wake-lock cleanup.

## 2. Frontend implementation

- [x] 2.1 Add the isolated feature folder with Zod selection parsing, reusable donut/sparkline cards, clock, and wake-lock hook.
- [x] 2.2 Render regular account and OpenCode Go states with 60-second react-query polling and localized copy.
- [x] 2.3 Register the lazy full-screen route, navigation entry, and Portuguese resource without changing the dashboard feature.

## 3. Verification

- [x] 3.1 Run focused frontend tests, typecheck, lint, and production build.
- [ ] 3.2 Validate the change and full spec tree with OpenSpec. (Scoped strict change validation passed. The full tree is blocked by the unrelated existing `model-source-routing` spec failure.)
- [ ] 3.3 Run Hallmark pre-emit check plus mandatory Matt Standards/Spec and code-review-graph reviews. (Hallmark static review completed; browser-width evidence and VCS-based Matt/code-review-graph reviews remain unavailable in this extracted checkout.)
