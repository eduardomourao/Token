## ADDED Requirements

### Requirement: Independent encrypted Google CLI monitors

The system MUST maintain at most one Gemini CLI monitor and one Antigravity monitor. Each monitor MUST store its OAuth refresh credential encrypted at rest and MUST NOT expose credentials, discovered OAuth client values, access tokens, raw upstream payloads, or credential-derived values in dashboard responses, audit events, logs, or sanitized errors. Neither monitor MUST create, alter, or participate in Accounts, ModelSources, or proxy routing.

#### Scenario: Validate replacement before persistence

- **WHEN** a dashboard writer submits a new refresh credential
- **THEN** the server MUST validate it through the provider's upstream collection flow before replacing the encrypted credential
- **AND** a validation failure MUST preserve the previously configured credential and last successful samples.

### Requirement: Gemini CLI usage collection

The Gemini monitor MUST exchange its refresh credential through Google's OAuth token endpoint, call `loadCodeAssist` using Gemini CLI metadata, then call `retrieveUserQuota` with the returned Cloud project. It MUST select the first available REQUESTS-preferred model bucket in each Pro Latest, Flash Latest, and Flash-Lite Latest preference list and map `remainingFraction` and `resetTime` into monitor windows.

#### Scenario: Gemini upstream failure

- **WHEN** OAuth refresh, a Cloud Code request, a payload parse, or a reset timestamp is invalid or fails
- **THEN** the monitor MUST preserve the last successful samples
- **AND** expose only a sanitized error category.

### Requirement: Antigravity usage collection

The Antigravity monitor MUST exchange its refresh credential through Google's OAuth token endpoint and call `fetchAvailableModels` with an Antigravity user agent. It MUST collapse matching model quota into Gemini and Claude+GPT groups by taking the lowest available fraction and earliest reset, and infer a five-hour window for resets within six hours or a weekly window for resets within eight days.

#### Scenario: Group quota response

- **WHEN** multiple models belong to a provider group
- **THEN** the monitor MUST publish the conservative shared-pool reading using the lowest `remainingFraction` and earliest valid reset.

### Requirement: Refresh, retention, and operator API

Each configured monitor MUST refresh on the scheduler leader every five minutes and persist successful windows as historical samples. The existing data-retention pass MUST remove samples older than 90 days. Authenticated users MUST be able to read state; dashboard writers MUST be able to configure, refresh, and remove each monitor through its dedicated API routes.

#### Scenario: Missing configuration

- **WHEN** a monitor is not configured
- **THEN** its read endpoint MUST return a non-error unconfigured state
- **AND** it MUST not perform upstream requests.

### Requirement: Landscape monitor visibility

The Usage Monitor MUST include Google AI Pro and Antigravity only when each monitor is configured. Gemini MUST render Pro Latest and Flash Latest as primary compact panels, with Flash-Lite when available. Antigravity MUST render Gemini Pool and Claude+GPT Pool compact panels, using their available inferred quota windows, without altering the existing account or OpenCode Go panels.

#### Scenario: Configured provider selection

- **WHEN** a configured provider is selected from the monitor carousel
- **THEN** the page MUST render its own compact provider dashboard
- **AND** swipe/dropdown navigation MUST preserve the selected source using the existing monitor storage contract.
