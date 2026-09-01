# Domain docs

This repository uses a single domain context.

Before changing behavior, schema, interfaces, or monitoring flows:

1. Read `CONTEXT.md` for the project's vocabulary.
2. Read the relevant `openspec/specs/**/spec.md` and `context.md` files.
3. Read any applicable decision in `docs/adr/` when present.

Use the terms defined in `CONTEXT.md`: an Account is proxy-routing data; a Usage Monitor is read-only telemetry and must not silently become routing or credential-management functionality.
