import { expect, test } from "bun:test";

import { hostedHealthPayload } from "../../lib/hosted-health.ts";

test("hosted health preserves the legacy liveness response", () => {
  expect(hostedHealthPayload("health")).toEqual({ status: "ok" });
  expect(hostedHealthPayload("live")).toEqual({
    status: "ok",
    checks: { runtime: "vercel", proxy_transport: "http_sse" },
  });
});

test("hosted readiness identifies the serverless HTTP/SSE scope", () => {
  expect(hostedHealthPayload("ready")).toEqual({
    status: "ok",
    checks: { runtime: "vercel", proxy_transport: "http_sse" },
  });
});

test("hosted startup probe is ready when its Function can respond", () => {
  expect(hostedHealthPayload("startup")).toEqual({
    status: "ok",
    checks: { runtime: "vercel", proxy_transport: "http_sse" },
  });
});
