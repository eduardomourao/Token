## ADDED Requirements

### Requirement: Usage monitor is independently laid out

The frontend MUST register `/usage-monitor` as a lazy-loaded authenticated route outside the normal application layout. The route MUST remain reachable from the core navigation while rendering no global header or status bar inside the monitor canvas.

#### Scenario: Navigation opens monitor without carrying desktop chrome

- **WHEN** an operator activates the Usage Monitor navigation entry
- **THEN** the application navigates to `/usage-monitor`
- **AND** the resulting page has only the monitor's own compact selector bar and dashboard content
