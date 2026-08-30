## MODIFIED Requirements

### Requirement: Configurable retention policy

The retention job MUST prune expired OpenCode Go usage-monitor samples using the fixed 90-day monitor policy in the same leader-gated hourly pass that handles other durable usage history.

#### Scenario: Expired monitor sample

- **GIVEN** an OpenCode Go usage-monitor sample older than 90 days
- **WHEN** the retention leader runs
- **THEN** the sample MUST be deleted without changing current monitor configuration or newer samples.
