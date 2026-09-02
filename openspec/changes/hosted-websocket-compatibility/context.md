# Context: hosted Responses WebSocket compatibility

## Purpose

Keep existing Responses WebSocket clients on their JSON-frame protocol while
migrating the transport to Vercel and Supabase. This is separate from the
private Live Voice WebSocket capability and does not make Supabase Phoenix
channels public proxy ingress.

## Decisions and constraints

- The Vercel Function is a short-lived protocol gateway, not a durable session
  owner. A reconnect can reach another Function instance.
- The existing Supabase `proxy-responses` Edge Function remains the sole
  holder of upstream credential access and account-selection behavior.
- Every client-visible outbound event is written to an owner-scoped durable
  spool before it is sent. A cursor is opaque, bounded and expires with the
  spool; raw OAuth credentials, API keys, input content and upstream tokens
  are never persisted in the spool or logs.
- The first deployment surface is an isolated probe path. It exists solely to
  prove Vercel upgrade behavior and must not redirect, rewrite or replace a
  native Responses WebSocket path.
- Client authorization happens before a successful upgrade. The gateway may
  forward only the validated bearer context plus a bounded affinity value to
  the existing Edge relay; it never exposes provider credentials.
- Local non-Next Vercel development cannot prove an upgrade, so local tests
  target the pure parser/adapter seam and a deployed, non-native probe is the
  first transport proof.

## Example

1. A client opens the isolated probe with its usual bearer authorization.
2. The gateway validates the bearer without selecting an upstream Account,
   then upgrades the connection.
3. A `response.create` frame is converted to a strict HTTP/SSE request for
   `proxy-responses`.
4. Each complete SSE `data:` record is persisted as the next spool event and
   emitted as one JSON WebSocket message.
5. If the client reconnects with an unexpired opaque cursor, another Function
   reads the same owner-scoped spool and re-emits only records after that
   cursor. If the gateway cannot establish that boundary, it fails closed
   rather than sending a duplicate turn.
