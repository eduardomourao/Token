# Issue tracker: Local Markdown

Migration specs and implementation tickets live in `.scratch/`.

## Conventions

- Use one feature directory: `.scratch/<feature-slug>/`.
- Keep the feature specification in `.scratch/<feature-slug>/spec.md`.
- Keep one implementation ticket per file under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.
- Record state near the top of every ticket with `Status:` and dependencies with `Blocked by:`.
- Append discussion and evidence under `## Comments` instead of overwriting history.

OpenSpec remains the behavioral source of truth. Local tickets organize the vertical work needed to implement an approved OpenSpec change.
