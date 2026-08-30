## Why

Operators need independent, durable visibility into the quotas consumed by Google AI Pro through Gemini CLI and Antigravity through agy/Cockpit. These credentials and quotas must never become proxy accounts or model-routing inputs.

## What Changes

- Add encrypted singleton monitors for Gemini CLI and Antigravity refresh credentials, current status, and historical usage samples.
- Refresh each configured monitor every five minutes through the scheduler leader using the upstream OAuth and Cloud Code endpoints verified by the supplied reference collectors.
- Add authenticated read/configure/refresh/remove endpoints and typed frontend clients.
- Add both configured monitors to the existing landscape Usage Monitor carousel while preserving the account and OpenCode Go paths.
- Retain samples for 90 days using the existing retention pass.

## Capabilities

### New Capabilities

- `google-cli-usage-monitors`

### Modified Capabilities

- `data-retention`
- `frontend-architecture`

## Impact

- New Gemini and Antigravity monitor modules, persistence models, Alembic migration, scheduler registration, authenticated APIs, frontend contracts, monitor dashboards, localization, and tests.
