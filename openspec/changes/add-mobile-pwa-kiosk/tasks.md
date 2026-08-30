## 1. Contracts and tests

- [x] 1.1 Define kiosk manifest, caching, progressive prompt, and generated-artifact requirements.
- [x] 1.2 Add RED tests for update availability and browser-supported installation prompt behavior.

## 2. PWA implementation

- [x] 2.1 Add vite-plugin-pwa and sharp using Bun; preserve current Vite output/manual chunk configuration.
- [x] 2.2 Add generated manifest/service-worker configuration, icon generation script/assets, HTML metadata, and type declarations.
- [x] 2.3 Add update toast and monitor-only install banner with localized copy.

## 3. Verification

- [x] 3.1 Generate icons and verify dimensions.
- [x] 3.2 Run focused tests, typecheck, lint, production build, and inspect generated manifest/service worker.
- [ ] 3.3 Validate OpenSpec and run Hallmark/Matt/code-review-graph review gates. (OpenSpec and Hallmark static pass recorded; browser and VCS-dependent gates are blocked by this extracted tree.)
