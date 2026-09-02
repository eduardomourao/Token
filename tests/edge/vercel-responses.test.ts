import { expect, test } from "bun:test";

import { buildEdgeFunctionHeaders } from "../../api/v1/responses.ts";

test("buildEdgeFunctionHeaders preserves only the caller JWT required by the Supabase Edge Function", () => {
  const headers = buildEdgeFunctionHeaders({
    authorization: "Bearer user-session-jwt",
    "content-type": "application/json",
    apikey: "browser-key-that-must-not-be-forwarded",
    host: "token-usage-monitor.vercel.app",
  });

  expect(headers).toEqual({
    authorization: "Bearer user-session-jwt",
    "content-type": "application/json",
  });
});

test("buildEdgeFunctionHeaders rejects a request without a bearer JWT", () => {
  expect(() => buildEdgeFunctionHeaders({ "content-type": "application/json" })).toThrow("authorization");
});
