import { expect, test } from "bun:test";

import {
  buildUpstreamHeaders,
  decryptCredential,
  encryptCredential,
  parseCompletedResponse,
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
  expect(headers["x-codex-session-id"]).toBe("session-1");
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
