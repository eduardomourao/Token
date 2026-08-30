# Context

## Vocabulary

- **Account**: OAuth-backed ChatGPT account eligible for proxy routing. OpenCode Go monitors are never Accounts.
- **Model source**: OpenAI-compatible upstream used for routed inference. OpenCode Go monitors are never model sources.
- **OpenCode Go monitor**: singleton, operator-configured telemetry integration that reads external usage limits without changing routing.
- **Usage sample**: durable reading for one monitor window at one collection timestamp.
- **Available percent**: upstream `percent` value; percent capacity remaining in a window.
- **Usage monitor**: full-screen, read-only phone dashboard for exactly one selected Account or the OpenCode Go monitor at a time; it never changes routing, credentials, or settings.
