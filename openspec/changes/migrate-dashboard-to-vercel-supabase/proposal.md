## Why

The current application runs as a persistent FastAPI service with a locally managed data directory and long-lived background loops. The product is being adapted to use GitHub for source control, Vercel for the web application and short request work, and Supabase for data, authentication, realtime updates and scheduled collectors.

## What Changes

- Establish a staged Vercel and Supabase target architecture for the dashboard and usage-monitoring experiences.
- Move durable relational data to Supabase Postgres under explicit access policies and controlled migration procedures.
- Replace eligible short collectors with idempotent scheduled work and publish completed updates through Realtime.
- Establish GitHub-based CI, preview deployment and reversible promotion gates.
- Define a compatibility boundary for the existing persistent OpenAI proxy, WebSocket and streaming functionality before implementation begins.

## Capabilities

### New Capabilities

- `vercel-supabase-dashboard-runtime`
- `vercel-supabase-data-migration`
- `vercel-supabase-release-governance`

### Modified Capabilities

- `frontend-architecture`
- `database-backends`
- `admin-auth`
- `usage-refresh-policy`

## Impact

- Application delivery, data ownership, authentication, scheduled collection, dashboard APIs and deployment workflow.
- The persistent proxy is explicitly not presumed portable; its inclusion requires a separate accepted compatibility design.

