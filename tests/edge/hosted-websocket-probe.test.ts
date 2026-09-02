import { expect, test } from "bun:test";

import {
  buildHostedWebSocketSpoolHeaders,
  buildHostedWebSocketPreflightHeaders,
  classifyHostedRelayFailure,
  isHostedWebSocketUpgrade,
} from "../../api/hosted-ws-probe.ts";

test("the hosted WebSocket probe recognizes only an explicit WebSocket upgrade", () => {
  expect(isHostedWebSocketUpgrade(new Request("https://example.test/api/hosted-ws-probe", {
    headers: { upgrade: "websocket" },
  }))).toBeTrue();
  expect(isHostedWebSocketUpgrade(new Request("https://example.test/api/hosted-ws-probe"))).toBeFalse();
  expect(isHostedWebSocketUpgrade(new Request("https://example.test/api/hosted-ws-probe", {
    headers: { upgrade: "h2c" },
  }))).toBeFalse();
});

test("the authorization preflight forwards only the caller bearer credential", () => {
  expect(buildHostedWebSocketPreflightHeaders(new Headers({
    authorization: "Bearer sk-clb-example",
    "x-codex-session-id": "must-not-be-needed-for-authentication",
    host: "token-usage-monitor.vercel.app",
  }))).toEqual({
    authorization: "Bearer sk-clb-example",
    "x-codex-websocket-auth-check": "1",
  });
  expect(() => buildHostedWebSocketPreflightHeaders(new Headers())).toThrow("authorization");
});

test("spool operations authenticate without accidentally becoming an auth preflight", () => {
  expect(buildHostedWebSocketSpoolHeaders(new Headers({
    authorization: "Bearer sk-clb-example",
  }), "create")).toEqual({
    authorization: "Bearer sk-clb-example",
    "content-type": "application/json",
    "x-codex-websocket-spool-action": "create",
  });
});

test("relay diagnostics expose only allowlisted contract failures", () => {
  expect(classifyHostedRelayFailure("Input must be a list")).toBe("input_must_be_list");
  expect(classifyHostedRelayFailure("Store must be set to false")).toBe("store_must_be_false");
  expect(classifyHostedRelayFailure("untrusted upstream body")).toBe("upstream_rejected");
});
