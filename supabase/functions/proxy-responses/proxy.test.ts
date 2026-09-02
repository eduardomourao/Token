import { expect, test } from "bun:test";

import {
  apiKeyHash,
  buildUpstreamHeaders,
  decryptCredential,
  encryptCredential,
  isHostedWebSocketAuthorizationCheck,
  parseHostedWebSocketSpoolOperation,
  mayFailoverBeforeVisibleOutput,
  parseCompletedResponse,
  retryAfterDeadline,
  sessionKeyHash,
} from "./proxy.ts";

const textEncoder = new TextEncoder();

async function encryptCredentialFixture(plaintext: string, key: Uint8Array, iv: Uint8Array): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, textEncoder.encode(plaintext));
  return `v1.${Buffer.from(iv).toString("base64url")}.${Buffer.from(ciphertext).toString("base64url")}`;
}

test("decryptCredential accepts the versioned AES-GCM credential envelope", async () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const iv = Uint8Array.from({ length: 12 }, (_, index) => index + 32);
  const envelope = await encryptCredentialFixture("access-token", key, iv);

  await expect(decryptCredential(envelope, Buffer.from(key).toString("base64url"))).resolves.toBe("access-token");
});

test("encryptCredential produces a fresh decryptable credential envelope", async () => {
  const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const encodedKey = Buffer.from(key).toString("base64url");
  const envelope = await encryptCredential("rotated-token", encodedKey);

  expect(envelope).toStartWith("v1.");
  await expect(decryptCredential(envelope, encodedKey)).resolves.toBe("rotated-token");
});

test("buildUpstreamHeaders removes caller credentials and applies the selected account identity", () => {
  const headers = buildUpstreamHeaders(
    {
      Authorization: "Bearer user-session-jwt",
      Host: "token-usage-monitor.vercel.app",
      "Content-Length": "100",
      "content-type": "text/plain",
      accept: "application/json",
      Forwarded: "for=198.51.100.1",
      "User-Agent": "openai-node/4",
      "x-codex-session-id": "session-1",
    },
    "upstream-access-token",
    "workspace-1",
  );

  expect(headers.Authorization).toBe("Bearer upstream-access-token");
  expect(headers["chatgpt-account-id"]).toBe("workspace-1");
  expect(headers.Host).toBeUndefined();
  expect(headers["Content-Length"]).toBeUndefined();
  expect(headers.Forwarded).toBeUndefined();
  expect(headers["x-codex-session-id"]).toBeUndefined();
  expect(headers["content-type"]).toBeUndefined();
  expect(headers.accept).toBeUndefined();
  expect(headers["Content-Type"]).toBe("application/json");
  expect(headers.Accept).toBe("text/event-stream");
});

test("parseCompletedResponse returns the completed response from an upstream SSE stream", () => {
  const completed = parseCompletedResponse(
    [
      "event: response.created\ndata: {\"type\":\"response.created\"}\n\n",
      "event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"status\":\"completed\"}}\n\n",
    ].join(""),
  );

  expect(completed).toEqual({ id: "resp_1", status: "completed" });
});

test("retryAfterDeadline applies a bounded Retry-After hint and safe fallback", () => {
  expect(retryAfterDeadline("90", 1_700_000_000)).toBe(1_700_000_090);
  expect(retryAfterDeadline(null, 1_700_000_000)).toBe(1_700_000_030);
  expect(retryAfterDeadline("99999", 1_700_000_000)).toBe(1_700_003_600);
});

test("mayFailoverBeforeVisibleOutput excludes streaming and non-rate-limit failures", () => {
  expect(mayFailoverBeforeVisibleOutput({ model: "gpt-5", input: "x" }, 429)).toBeTrue();
  expect(mayFailoverBeforeVisibleOutput({ model: "gpt-5", input: "x", stream: true }, 429)).toBeFalse();
  expect(mayFailoverBeforeVisibleOutput({ model: "gpt-5", input: "x" }, 502)).toBeFalse();
});

test("sessionKeyHash hashes accepted session ids and rejects oversized or missing values", async () => {
  await expect(sessionKeyHash("session-1")).resolves.toBe("84097828fc31a8c8d29210df48901a85de7fd013f686b17be77d1be29cb7a98b");
  await expect(sessionKeyHash(null)).resolves.toBeNull();
  await expect(sessionKeyHash("x".repeat(513))).resolves.toBeNull();
});

test("apiKeyHash accepts the hosted key format and never returns the plaintext", async () => {
  await expect(apiKeyHash("sk-clb-example")).resolves.toBe("d215ecd55a0efa8d5cdbf9141d151277cf078f41296510e7152d43d88f4b5a93");
  await expect(apiKeyHash("not-a-hosted-key")).resolves.toBeNull();
  await expect(apiKeyHash(`sk-clb-${"x".repeat(513)}`)).resolves.toBeNull();
});

test("websocket authorization preflight is an exact internal marker", () => {
  expect(isHostedWebSocketAuthorizationCheck(new Headers({ "x-codex-websocket-auth-check": "1" }))).toBeTrue();
  expect(isHostedWebSocketAuthorizationCheck(new Headers({ "x-codex-websocket-auth-check": "true" }))).toBeFalse();
  expect(isHostedWebSocketAuthorizationCheck(new Headers())).toBeFalse();
});

test("websocket spool operations accept only bounded owner-safe payloads", () => {
  expect(parseHostedWebSocketSpoolOperation("create", {
    spool_id: "00000000-0000-4000-8000-000000000001",
    session_key_hash: "a".repeat(64),
  })).toEqual({
    action: "create",
    spoolId: "00000000-0000-4000-8000-000000000001",
    sessionKeyHash: "a".repeat(64),
  });
  expect(parseHostedWebSocketSpoolOperation("append", {
    spool_id: "00000000-0000-4000-8000-000000000001",
    event_frame: { type: "response.created" },
    is_terminal: false,
  })).toEqual({
    action: "append",
    spoolId: "00000000-0000-4000-8000-000000000001",
    eventFrame: { type: "response.created" },
    isTerminal: false,
  });
  expect(parseHostedWebSocketSpoolOperation("read", {
    spool_id: "00000000-0000-4000-8000-000000000001",
    after_cursor: 4,
  })).toEqual({ action: "read", spoolId: "00000000-0000-4000-8000-000000000001", afterCursor: 4 });
  expect(parseHostedWebSocketSpoolOperation("append", {
    spool_id: "not-a-uuid",
    event_frame: { type: "response.created" },
  })).toBeNull();
  expect(parseHostedWebSocketSpoolOperation("read", {
    spool_id: "00000000-0000-4000-8000-000000000001",
    after_cursor: -1,
  })).toBeNull();
});
