## 1. Discovery and contracts

- [x] 1.1 Preserve a verified pre-migration source snapshot outside the workspace.
- [x] 1.2 Identify persistent runtime dependencies and record the serverless compatibility boundary.
- [ ] 1.3 Define canonical identities, authorization ownership, encrypted-secret custody and required data-retention rules.
- [ ] 1.4 Define public parity seams for dashboard, monitor, auth, scheduled collectors and rollback.
- [ ] 1.5 Obtain an explicit product decision for the persistent proxy and WebSocket/streaming contracts.

## 2. Foundation vertical slice

- [ ] 2.1 Bootstrap a versioned GitHub repository from the verified source without replacing the existing remote contents blindly.
- [~] 2.2 Add an isolated Supabase development schema and RLS policy set with migration and rollback tests. (Gemini first slice: SQL contract test RED.)
- [ ] 2.3 Add a Vercel preview application that serves one authenticated, read-only dashboard slice.
- [ ] 2.4 Compare the slice with the current runtime using contract and browser acceptance tests.

## 3. Incremental migration

- [ ] 3.1 Migrate one short, idempotent usage collector to Cron plus an Edge Function and Realtime update.
- [ ] 3.2 Migrate accounts, histories and dashboard reads in vertical slices while keeping the legacy source authoritative.
- [ ] 3.3 Add encrypted data transfer, consistency checks and a shadow-mode comparison job.
- [ ] 3.4 Produce a separate accepted design for every persistent proxy, SSE or WebSocket contract that remains in scope.

## 4. Release

- [ ] 4.1 Run migration rehearsal and rollback rehearsal from the validated snapshot.
- [ ] 4.2 Promote only after data, security, behavior and cost gates pass.
- [ ] 4.3 Observe the promoted application and retain the legacy rollback path through the agreed stability window.
