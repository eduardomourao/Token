## ADDED Requirements

### Requirement: Secure, independent OpenCode Go monitor

The system MUST store at most one OpenCode Go credential encrypted at rest and MUST NOT expose it in API responses, audit data, logs, or client code. The monitor MUST NOT create or alter Accounts, ModelSources, or proxy routing behavior.

#### Scenario: Configure a valid credential

- **WHEN** a dashboard writer submits a valid OpenCode Go credential
- **THEN** the server MUST validate it against the upstream usage API before replacing the stored credential
- **AND** it MUST persist no plaintext credential.

### Requirement: Usage collection and history

The scheduler leader MUST refresh configured monitor usage every 120 seconds and persist one sample for each `rolling`, `weekly`, and `monthly` window after a valid upstream response. Samples older than 90 days MUST be pruned by data retention.

#### Scenario: Upstream refresh failure

- **WHEN** upstream responds with an invalid payload, an error response, or times out
- **THEN** the server MUST preserve the last successful samples
- **AND** expose a sanitized monitor error state.

### Requirement: Operator visibility and export

Authenticated dashboard users MUST be able to read the current monitor state. Dashboard writers MUST be able to configure, remove, and manually refresh it. The system MUST expose retained samples as CSV with `captured_at`, `window`, `remaining_percent`, `used_percent`, and `resets_at`.

#### Scenario: No configured credential

- **WHEN** no OpenCode Go credential is configured
- **THEN** the dashboard MUST render a non-error setup state linking to Settings.
