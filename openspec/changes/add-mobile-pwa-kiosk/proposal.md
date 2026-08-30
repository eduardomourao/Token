## Why

The Usage Monitor is designed to remain open on a phone. Operators need to install it as a fullscreen, portrait-oriented app that starts directly on the monitor route and remains usable briefly with recent cached data during a network interruption.

## What Changes

- Configure vite-plugin-pwa to generate the web manifest and service worker into the existing `app/static` build output.
- Generate reusable Android and iOS icon assets from the existing Codex LB SVG.
- Add progressive update and install prompts without changing normal desktop SPA behavior.
- Cache the application shell with stale-while-revalidate and same-origin API responses with a bounded network-first policy.

## Capabilities

### New Capabilities

- `mobile-pwa-kiosk`

### Modified Capabilities

- `frontend-architecture`

## Impact

- Frontend Vite tooling/configuration, generated static artifacts, icon script/assets, PWA UI components, translations, tests, and OpenSpec docs only.
- No Python routing, existing page behavior, API response schema, or static output directory change.
