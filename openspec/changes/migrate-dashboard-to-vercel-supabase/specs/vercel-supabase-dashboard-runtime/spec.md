# vercel-supabase-dashboard-runtime Specification

## Purpose

Define a Vercel preview foundation for the existing Vite dashboard while preserving the current FastAPI-backed local development path.

## Requirements

### Requirement: Preview build is explicit and credential-free

The repository MUST declare how Vercel builds the existing frontend without embedding a Vercel project identifier, token, private API endpoint or production domain.

#### Scenario: Preview build configuration is inspected

- **WHEN** a maintainer inspects the Vercel configuration
- **THEN** the frontend build command and static output are explicit
- **AND** the configuration contains no deployment credentials or project-bound identifiers

### Requirement: Local API proxy remains intact

The Vercel preview foundation MUST NOT change the existing local Vite development proxy to the FastAPI runtime.

#### Scenario: Existing local frontend development starts

- **WHEN** a maintainer starts the current frontend development server without Vercel-specific environment variables
- **THEN** requests to the existing local API paths retain their FastAPI proxy behavior

### Requirement: No preview is promoted implicitly

The foundation MUST support later preview deployment but MUST NOT include an automatic production deployment or domain cutover.

#### Scenario: Versioned foundation is merged

- **WHEN** the foundation configuration is merged
- **THEN** no production domain, Vercel production deployment or Supabase data migration is triggered by that merge alone

