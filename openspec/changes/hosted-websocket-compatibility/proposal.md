# Hosted Responses WebSocket compatibility

## Why

The hosted Vercel/Supabase deployment already exposes the Responses HTTP and
SSE contract. The legacy proxy also exposes WebSocket Responses endpoints,
where one socket carries sequential `response.create` work, cancellation,
owner affinity and carefully bounded recovery. Supabase Realtime uses a
different Phoenix protocol, and a Vercel Function cannot keep future
connections on the same instance. Replacing the existing client protocol with
either transport would silently break clients.

## What Changes

- Introduce a staged, Vercel-hosted Responses WebSocket gateway design that
  preserves the client frame contract while using the existing Supabase Edge
  HTTP/SSE relay for account selection and credentials.
- Build and test a dependency-free framing boundary before exposing a new
  WebSocket route: validate a single `response.create`, convert incremental
  SSE records to Responses JSON frames, and classify terminal/cancel states.
- Define Supabase-owned durable event-spool and replay cursor requirements for
  reconnects that can land on another Vercel Function.
- Reserve a non-native probe route for remote WebSocket upgrade verification.
  The native `/backend-api/codex/responses` and `/v1/responses` WebSocket paths
  remain unmodified until the full remote compatibility suite passes.

## Capabilities

### Modified Capabilities

- `responses-api-compat`

## Impact

- New Vercel WebSocket gateway and pure protocol adapter modules.
- Supabase Edge authentication preflight and owner-scoped spool tables/RLS.
- Remote deployment tests for the upgrade path; local tests cover pure framing
  only because Vercel's experimental WebSocket upgrade cannot be exercised in
  this Vite runtime locally.
