import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const configPath = `${repositoryRoot}vercel.json`;
const rawConfig = await readFile(configPath, "utf8");
const config = JSON.parse(rawConfig);

const expectedRewrite = "/((?!api(?:/|$)|v1(?:/|$)|backend-api(?:/|$)|health(?:/|$)).*)";
const errors = [];

if (config.framework !== "vite") {
  errors.push('Expected "framework" to be "vite".');
}

if (config.installCommand !== "cd frontend && bun install --frozen-lockfile") {
  errors.push("Expected the frontend-only frozen Bun install command.");
}

if (config.buildCommand !== "cd frontend && bun run build") {
  errors.push("Expected the frontend-only Vite build command.");
}

if (config.outputDirectory !== "app/static") {
  errors.push('Expected "outputDirectory" to be "app/static".');
}

if (config.rewrites?.length !== 1 || config.rewrites[0]?.source !== expectedRewrite || config.rewrites[0]?.destination !== "/index.html") {
  errors.push("Expected one SPA rewrite that excludes the backend endpoint prefixes.");
}

const spaRoute = new RegExp(`^${expectedRewrite}$`);
for (const path of ["/", "/usage-monitor", "/app/dashboard"]) {
  if (!spaRoute.test(path)) {
    errors.push(`Expected the SPA rewrite to accept ${path}.`);
  }
}

for (const path of ["/api", "/api/accounts", "/v1/models", "/backend-api/status", "/health"]) {
  if (spaRoute.test(path)) {
    errors.push(`Expected the SPA rewrite to exclude ${path}.`);
  }
}

for (const prohibitedKey of ["builds", "crons", "env", "functions", "regions"]) {
  if (prohibitedKey in config) {
    errors.push(`Static foundation must not declare ${prohibitedKey}.`);
  }
}

if (errors.length > 0) {
  console.error("Vercel preview foundation validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Vercel preview foundation validation passed.");
}
