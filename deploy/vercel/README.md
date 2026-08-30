# Vercel preview foundation

This foundation serves the existing Vite dashboard as a static single-page application.
It is intentionally credential-free and does not create, link, or deploy a Vercel project.

## What is served

- The install and build commands run in `frontend/` with the version of Bun declared in `frontend/package.json`.
- The generated static files are read from `app/static/`.
- Client-side routes such as `/usage-monitor` fall back to `index.html`.

## What is not served

This configuration does not provide a backend or proxy. The `/api`, `/v1`,
`/backend-api`, and `/health` prefixes are deliberately excluded from the SPA
fallback. They require a separately designed and deployed backend before a
preview can have live data.

The existing FastAPI proxy remains a local-development concern in
`frontend/vite.config.ts`; this foundation does not change it.

## Static validation

From the repository root, run:

```powershell
node deploy/vercel/validate-vercel-config.mjs
```

The script checks only the version-controlled configuration. It does not read
credentials, contact Vercel, create a project, or trigger a deployment.

When an authorized Vercel project is configured later, also run the existing
frontend build before using a preview:

```powershell
Set-Location frontend
bun run build
```
