## ADDED Requirements

### Requirement: Generated kiosk manifest

The frontend build MUST generate a web app manifest through vite-plugin-pwa in the existing static output directory. The manifest MUST name Codex LB Usage Monitor, use fullscreen display, portrait orientation, `/usage-monitor` start URL, `/` scope, a dark `#09090b` theme/background, and 192 px plus 512 px PNG icons including a maskable 512 px icon.

#### Scenario: Installed app starts in the monitor

- **WHEN** an operator installs and launches the web application from a supported mobile browser
- **THEN** the installed application opens at `/usage-monitor`
- **AND** it requests fullscreen portrait presentation using the configured manifest

### Requirement: Offline-aware app shell and API cache

The generated service worker MUST cache JavaScript, CSS, HTML, SVG, and webfont app-shell assets with stale-while-revalidate behavior. Same-origin `/api/` responses MUST use network-first behavior with a 10-second network timeout, a maximum of 50 entries, and a 300-second maximum age.

#### Scenario: Recent API reading is available during interruption

- **GIVEN** an API response was successfully read within the cache lifetime
- **WHEN** the device temporarily loses network access
- **THEN** the service worker MAY return the recent cached response after the 10-second network-first attempt

### Requirement: Progressive PWA controls

The frontend MUST show an update toast only when the PWA registration reports that a refresh is available. The toast MUST offer an explicit update action. On browsers that dispatch `beforeinstallprompt`, the Usage Monitor MUST show a dismissible install action; unsupported browsers and desktop use MUST continue without an install control.

#### Scenario: Supported mobile browser defers installation

- **WHEN** a supported browser dispatches `beforeinstallprompt` while `/usage-monitor` is open
- **THEN** the monitor displays an install action
- **WHEN** the operator dismisses it
- **THEN** the prompt is hidden and that local browser does not show it again

### Requirement: Icon and iOS metadata pipeline

The frontend MUST provide 192x192, 512x512, and 180x180 PNG icon assets generated from the existing favicon source. The HTML entry document MUST include dark theme-color and Apple mobile web app metadata referencing the generated touch icon.

#### Scenario: Built assets include icon and PWA entry metadata

- **WHEN** the production frontend build completes
- **THEN** the static output contains the generated manifest, service worker, and referenced icon assets
- **AND** the HTML head contains the Apple touch and fullscreen metadata
