## Why

Operators need a glanceable, always-on phone surface for one account's current limits and recent activity without the desktop dashboard's tables, navigation, or settings controls.

## What Changes

- Add a lazy-loaded authenticated `/usage-monitor` route with its own full-viewport layout.
- Allow choosing one existing account, or the independently configured OpenCode Go usage monitor, and persist that choice locally.
- Reuse existing account, dashboard-overview, and OpenCode Go monitor APIs with 60-second client polling.
- Add an optional browser screen wake lock and force the existing dark theme while the monitor is mounted.

## Capabilities

### New Capabilities

- `mobile-usage-monitor`

### Modified Capabilities

- `frontend-architecture`

## Impact

- Isolated frontend feature components, route registration, core navigation, locale resources, and frontend tests only.
- No backend API, database, routing, account, or existing dashboard-page changes.
