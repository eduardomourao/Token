import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { buildEdgeFunctionHeaders } from "../../api/v1/responses.ts";
import { shouldUpgradeHostedResponses } from "../../api/v1/responses-ws.ts";

test("buildEdgeFunctionHeaders keeps the caller credential and opaque affinity key only at the hosted boundary", () => {
  const headers = buildEdgeFunctionHeaders({
    authorization: "Bearer user-session-jwt",
    "content-type": "application/json",
    "x-codex-session-id": "session-1",
    apikey: "browser-key-that-must-not-be-forwarded",
    host: "token-usage-monitor.vercel.app",
  });

  expect(headers).toEqual({
    authorization: "Bearer user-session-jwt",
    "content-type": "application/json",
    "x-codex-session-id": "session-1",
  });
});

test("Vercel routes both native Responses aliases through the hosted relay", () => {
  const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
    rewrites: Array<{ source: string; destination: string }>;
  };

  expect(config.rewrites).toContainEqual({
    source: "/backend-api/codex/responses",
    destination: "/api/backend-api/codex/responses",
  });
  expect(config.rewrites).toContainEqual({
    source: "/backend-api/codex/v1/responses",
    destination: "/api/backend-api/codex/responses",
  });
});

test("buildEdgeFunctionHeaders rejects a request without a bearer JWT", () => {
  expect(() => buildEdgeFunctionHeaders({ "content-type": "application/json" })).toThrow("authorization");
});

test("buildEdgeFunctionHeaders accepts the explicit Vercel-safe JWT header", () => {
  expect(buildEdgeFunctionHeaders({ "x-supabase-authorization": "Bearer user-session-jwt" })).toEqual({
    authorization: "Bearer user-session-jwt",
    "content-type": "application/json",
  });
});

test("buildEdgeFunctionHeaders forwards a Bearer API key for Edge-side validation", () => {
  expect(buildEdgeFunctionHeaders({ authorization: "Bearer sk-clb-example" })).toEqual({
    authorization: "Bearer sk-clb-example",
    "content-type": "application/json",
  });
});

test("native Responses routes delegate only real WebSocket upgrades to the hosted gateway", () => {
  expect(shouldUpgradeHostedResponses({ method: "GET", headers: { upgrade: "websocket" } })).toBeTrue();
  expect(shouldUpgradeHostedResponses({ method: "POST", headers: { upgrade: "websocket" } })).toBeFalse();
  expect(shouldUpgradeHostedResponses({ method: "GET", headers: {} })).toBeFalse();
});

test("the Codex alias shares the native HTTP and WebSocket adapter", () => {
  const alias = readFileSync(new URL("../../api/backend-api/codex/responses.ts", import.meta.url), "utf8");
  expect(alias).toContain('from "../../v1/responses-ws"');
});
