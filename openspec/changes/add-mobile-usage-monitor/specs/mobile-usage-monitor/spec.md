## ADDED Requirements

### Requirement: Standalone mobile monitoring route

The authenticated frontend MUST expose a lazy-loaded `/usage-monitor` route. The route MUST render its own full-viewport canvas and MUST NOT render `AppHeader`, `StatusBar`, or the normal maximum-width page wrapper. The page MUST force the existing dark theme while mounted and MUST release its browser screen wake lock when it unmounts.

#### Scenario: Full-screen route is opened

- **WHEN** an authenticated operator opens `/usage-monitor`
- **THEN** the page renders a `min-h-screen` monitoring canvas without global application chrome
- **AND** the browser requests a screen wake lock when the platform supports it

### Requirement: Single persisted monitor selection

The monitor MUST display exactly one selected source at a time. Its selector MUST list all results from the existing account-list API and MUST append OpenCode Go only when the existing OpenCode Go monitor reports `configured=true`. It MUST persist a valid selection in local storage and MUST fall back safely when a stored selection no longer exists.

#### Scenario: Configured OpenCode Go appears after accounts

- **GIVEN** the OpenCode Go monitor is configured
- **WHEN** the selector renders
- **THEN** it lists every account by display name, alias, or email
- **AND** it appends OpenCode Go as the final option

### Requirement: Selected account usage dashboard

For an Account selection, the monitor MUST show primary and secondary credit-window donuts, and MUST show a monthly donut when a monthly capacity exists. It MUST show daily and weekly sparkline cards from the existing 1d and 7d dashboard overview queries, and selected-account request count, token, and USD cost totals. It MUST reuse the existing chart components and MUST not modify the existing dashboard page.

#### Scenario: Account with monthly capacity is selected

- **GIVEN** a selected account has primary, secondary, and monthly capacities
- **WHEN** its monitor dashboard renders
- **THEN** each available window renders its remaining credits, capacity, and reset countdown
- **AND** daily and weekly activity plus request totals render in the same full-screen dashboard

### Requirement: OpenCode Go usage dashboard

For an OpenCode Go selection, the monitor MUST render one donut for every returned rolling, weekly, and monthly window, showing available and used percent plus reset countdown. It MUST show the last successful synchronization timestamp and a clear stale/error state without exposing a credential.

#### Scenario: OpenCode Go is selected after a failed refresh

- **GIVEN** the monitor is configured and has a last successful reading plus a sanitized refresh error
- **WHEN** OpenCode Go is selected
- **THEN** the last successful windows remain visible
- **AND** the page identifies the reading as stale without displaying sensitive data

### Requirement: Always-on refresh and mobile layout

The selector and relevant selected-source queries MUST poll every 60 seconds. The clock MUST indicate fetch activity subtly. The dashboard MUST use one column below 640 px and two columns at or above 640 px, use readable percentage typography, and permit scrolling only when content exceeds the viewport.

#### Scenario: Monitor remains open

- **WHEN** the page remains open for at least 60 seconds
- **THEN** relevant data is refreshed through react-query
- **AND** the live clock continues updating once per second
