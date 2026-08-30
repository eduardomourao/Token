## ADDED Requirements

### Requirement: Landscape kiosk account carousel

The standalone Usage Monitor MUST build one ordered selection list from configured Codex accounts followed by OpenCode Go when configured. It MUST persist the active selection, allow direct selection from its compact selector, and move to the adjacent selection on a horizontal touch swipe of at least 50 CSS pixels while ignoring vertical-dominant gestures. It MUST render an active carousel indicator.

#### Scenario: Operator swipes to the next source

- **GIVEN** two or more monitor selections are available
- **WHEN** the operator swipes left by at least 50 CSS pixels across the dashboard
- **THEN** the next selection is rendered with a horizontal transition
- **AND** its selection is persisted for the next launch

### Requirement: Landscape-only two-panel monitor

The monitor MUST request a landscape orientation lock when the platform supports it and release that lock on unmount. In portrait orientation it MUST replace dashboard content with a localized rotation instruction. In landscape it MUST render exactly two fixed side-by-side panels: Daily and Weekly.

#### Scenario: Device is held in portrait

- **WHEN** the monitor detects portrait orientation
- **THEN** it displays a rotation instruction instead of the usage dashboard

### Requirement: Compact used-percent panels

Each panel MUST show used percentage as its primary value, available percentage as secondary context, its reset countdown, and a compact donut. The donut color MUST be green through 50% used, yellow through 75%, orange through 90%, and red thereafter. Missing primary/rolling or secondary/weekly data MUST retain the two-panel structure with a localized unavailable placeholder.

#### Scenario: Weekly limit is unavailable

- **GIVEN** the selected Codex account has no secondary limit
- **WHEN** its monitor view renders in landscape
- **THEN** the Daily panel remains visible
- **AND** the Weekly panel shows the localized no-weekly-limit placeholder
