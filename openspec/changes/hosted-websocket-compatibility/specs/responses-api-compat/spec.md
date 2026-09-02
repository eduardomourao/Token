# responses-api-compat Delta Specification

## ADDED Requirements

### Requirement: Hosted Responses WebSocket rollout is staged and protocol-faithful

The hosted deployment MUST NOT substitute Supabase Realtime/Phoenix messages
for the existing Responses WebSocket JSON-frame protocol. Before a native
Responses WebSocket path is remapped, the implementation MUST expose only an
isolated non-native probe route and prove, against a Vercel deployment, an
authorized upgrade, unauthorized pre-upgrade denial, message-size enforcement
and credential/content-free diagnostics. Existing native Responses WebSocket
routes and their HTTP/SSE equivalents MUST remain unchanged throughout that
probe stage.

#### Scenario: probe has not passed its remote contract

- **WHEN** the isolated hosted probe lacks deployed compatibility evidence
- **THEN** `/backend-api/codex/responses` and `/v1/responses` retain their
  existing WebSocket routing
- **AND** the published HTTP/SSE Responses paths retain their behavior
- **AND** no Supabase Phoenix endpoint is advertised as a compatible route

#### Scenario: unauthorized caller attempts an upgrade

- **WHEN** a caller omits or supplies invalid proxy authorization to the
  isolated hosted probe
- **THEN** the gateway denies the request before it upgrades
- **AND** it does not select an Account, contact an upstream provider or
  disclose credential details

### Requirement: Hosted gateway preserves safe frame boundaries

For a successfully upgraded hosted Responses socket, the gateway MUST accept
only supported, bounded JSON client frames. It MUST map a valid
`response.create` frame to the existing authenticated HTTP/SSE Responses relay
without exposing provider credentials, and MUST emit complete SSE `data:`
records as individual JSON Responses frames in their original order. Invalid,
oversized or malformed frames MUST receive one credential-safe protocol error
and MUST NOT be forwarded upstream. A syntactically valid non-create frame
MUST retain the legacy Responses socket's no-op behavior and MUST NOT be
forwarded upstream.

#### Scenario: fragmented SSE stream reaches the client

- **GIVEN** a valid response-create request produces SSE where a `data:` value
  is split across transport chunks
- **WHEN** the gateway receives the chunks
- **THEN** it emits no partial JSON frame
- **AND** after the record delimiter arrives it emits exactly one corresponding
  JSON WebSocket message in order

#### Scenario: gateway receives a non-create client frame

- **WHEN** an upgraded client sends a syntactically valid non-create frame
- **THEN** the gateway preserves the legacy no-op behavior
- **AND** it does not invoke the HTTP/SSE relay or create a durable spool row

### Requirement: Hosted reconnect uses durable owner-scoped replay state

The hosted gateway MUST NOT rely on Vercel Function memory or a Supabase
Phoenix channel for replay. Before an emitted non-terminal event becomes
visible to the client, the gateway MUST persist it in an owner-scoped,
bounded and expiring Supabase spool with a monotonic opaque cursor. A reconnect
MUST replay only events strictly after the supplied valid cursor. If a replay
boundary, ownership or deduplication guarantee cannot be proved, the gateway
MUST fail closed and MUST NOT retransmit a potentially duplicated turn.

#### Scenario: reconnect reaches a different Function instance

- **GIVEN** a socket has received events through an unexpired spool cursor
- **WHEN** the client reconnects and the request runs in another Vercel
  Function instance with the same authorized owner
- **THEN** the gateway reads replay state from Supabase rather than memory
- **AND** it emits only events after that cursor

#### Scenario: cursor belongs to another owner or expired spool

- **WHEN** a client presents a cursor that is expired or not owned by its
  authorized principal
- **THEN** the gateway rejects replay without revealing the spool contents
- **AND** it does not substitute another Account or replay a create request
