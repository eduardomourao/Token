## MODIFIED Requirements

### Requirement: Dashboard feature boundaries

The dashboard MUST render OpenCode Go monitor state through a dedicated typed API feature rather than expanding the account overview contract. The Settings page MUST host credential management and CSV export, while the Dashboard page hosts read-only limit visibility and manual refresh for writers.

#### Scenario: Stale monitor state

- **GIVEN** the latest OpenCode Go collection failed after at least one successful sample
- **WHEN** a user views the dashboard card
- **THEN** it MUST show the last successful limits, their collection time, and a stale/error indication.
