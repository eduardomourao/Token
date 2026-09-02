# Tasks: hosted-websocket-compatibility

## 1. Contract and protocol boundary

- [x] 1.1 Inventory the legacy Responses WebSocket ingress, authentication,
      response-create serialization, response-id continuity and replay limits.
- [x] 1.2 Verify that Vercel's experimental upgrade API supports a Function
      outside Next.js, but that instance-local memory cannot provide reconnect
      continuity; verify Supabase Realtime's Phoenix protocol is not an
      equivalent client transport.
- [x] 1.3 Add red/green tests for the pure gateway boundary: exactly one
      supported client create frame, fragmented SSE parsing, terminal event
      detection, malformed-frame rejection and legacy no-op handling for
      non-create frames.

## 2. Isolated upgrade proof

- [x] 2.1 Add a non-native Vercel probe route that validates authorization
      before upgrade, enforces message bounds and never logs request content or
      credentials.
- [ ] 2.2 Deploy the probe and verify a real authenticated WebSocket handshake
      plus an unauthorized pre-upgrade denial. Do not publish it as a native
      route or change an existing rewrite.

## 3. Durable gateway

- [ ] 3.1 Add an owner-scoped Supabase spool/cursor schema, retention job and
      RLS tests. Persist each outbound event before it is visible to the
      downstream socket.
- [ ] 3.2 Relay a validated create to the existing HTTP/SSE proxy with only
      the authenticated caller context and a bounded session affinity key.
- [ ] 3.3 Support one explicit cancellation path and one replay path from a
      persisted cursor; refuse replay when a frame was visible but cannot be
      proven non-duplicating.
- [ ] 3.4 Add remote end-to-end tests for create, incremental events,
      cancellation, reconnect on a different Function and non-duplication.

## 4. Cutover

- [ ] 4.1 Compare the remote compatibility suite against legacy behavior and
      document every unsupported client frame.
- [ ] 4.2 Only after all required compatibility scenarios pass, map the
      native WebSocket paths to the hosted gateway with a reversible release.

## 5. Verification

- [ ] 5.1 Run focused boundary tests, TypeScript checks, production build,
      strict OpenSpec validation and deployed upgrade evidence.
