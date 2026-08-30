## ADDED Requirements

### Requirement: Frontend PWA assets retain the static serving contract

The frontend MUST generate all PWA manifest, service-worker, and icon artifacts into the existing `app/static` output directory. It MUST preserve the configured Vite manual chunking behavior and MUST not require Python backend route changes for PWA asset delivery.

#### Scenario: Python-backed SPA serves PWA artifacts

- **WHEN** the frontend production build runs
- **THEN** PWA files are emitted under the existing static output root
- **AND** the backend can serve their root-relative URLs without a new application route
