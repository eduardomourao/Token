# vercel-supabase-data-migration Specification

## Purpose

Define the safe Supabase development foundation before any real application data or credentials are migrated.

## Requirements

### Requirement: Supabase foundation is environment-neutral

The repository MUST provide versioned Supabase development configuration and migrations without hard-coding a remote project reference, access key, database password or production data.

#### Scenario: Foundation is cloned by another maintainer

- **WHEN** a maintainer clones the repository
- **THEN** the Supabase foundation can be configured with that maintainer's local or development environment
- **AND** no existing remote Supabase project is selected implicitly

### Requirement: Browser access is denied by default

Every initial application table introduced for the staged migration MUST enable row-level security and expose no permissive browser policy until an ownership contract is implemented and tested.

#### Scenario: Anonymous browser query reaches a foundation table

- **WHEN** an anonymous browser client queries an initial migration table
- **THEN** the request is denied by row-level security

### Requirement: Usage monitor snapshots are owner-scoped and idempotent

The staged Gemini usage-monitor slice MUST store monitor state, collection attempts, and normalized window snapshots separately from Accounts and ModelSources. Browser reads MUST be restricted to the authenticated owner. A collection identity MUST be unique per monitor and collection slot so retries cannot duplicate a completed sample.

#### Scenario: An owner reads a completed Gemini sample

- **WHEN** an authenticated owner selects the Gemini monitor
- **THEN** they can read only their monitor, collections, and snapshots
- **AND** the browser cannot read any encrypted credential material

#### Scenario: A scheduled collector retries the same slot

- **WHEN** the collector records a second result for the same monitor and collection slot
- **THEN** the write is idempotent
- **AND** no second completed sample is created

### Requirement: Database changes are reversible in development

The migration foundation MUST document an ordered local apply and reset procedure that does not touch any existing application database.

#### Scenario: Development migration is rehearsed

- **WHEN** a maintainer applies then resets the foundation locally
- **THEN** the operation affects only the configured development Supabase database
- **AND** no legacy database path or data directory is modified
