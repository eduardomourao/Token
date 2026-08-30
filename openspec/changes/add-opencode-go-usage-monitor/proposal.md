## Why

Operators need a durable view of their OpenCode Go allowance without turning it into a routed account or model provider.

## What Changes

- Add one encrypted, singleton OpenCode Go monitor and persisted rolling, weekly, and monthly samples.
- Fetch the upstream usage API every two minutes on the scheduler leader, with manual refresh and CSV export.
- Add authenticated dashboard and settings surfaces. Keep all routing and account behavior unchanged.
- Retain monitor samples for 90 days using the existing retention job.

## Capabilities

### New Capabilities

- `opencode-go-usage-monitor`

### Modified Capabilities

- `data-retention`
- `frontend-architecture`

## Impact

- New backend monitor module, schema migration, scheduler, authenticated API, frontend feature, localization, and tests.
