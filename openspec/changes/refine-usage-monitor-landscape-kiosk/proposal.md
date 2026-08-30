## Why

The installed Usage Monitor is intended for an always-on Galaxy J8 landscape screen. Its current portrait-oriented, multi-card dashboard consumes more space than the kiosk viewport permits and requires dropdown interaction for account switching.

## What Changes

- Replace portrait-only PWA orientation with an orientation-neutral manifest and lock the monitor route to landscape when supported.
- Add touch-only horizontal account navigation with an ordered, persisted selection index and visible carousel position.
- Gate the dashboard in portrait orientation with an accessible rotation instruction.
- Reduce each account view to exactly Daily and Weekly usage panels, showing used percentage and usage-level color instead of trends, monthly limits, or request statistics.
- Remove the unused monitor sparkline wrapper and compact the donut rendering for the 740x360 CSS-pixel kiosk target.

## Impact

- Frontend monitor components, i18n strings, PWA manifest configuration, and focused frontend tests only.
- No backend API, routing, credential, account-routing, or dashboard-page contract changes.
