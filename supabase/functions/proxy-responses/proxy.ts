const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

const BLOCKED_INBOUND_HEADERS = new Set([
  "authorization",
  "chatgpt-account-id",
  "content-length",
  "host",
  "forwarded",
  "x-real-ip",
  "true-client-ip",
  "x-codex-session-id",
]);

function toHeaderEntries(headers: Headers | Record<string, string>): Iterable<[string, string]> {
  return headers instanceof Headers ? headers.entries() : Object.entries(headers);
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(value: Uint8Array): ArrayBuffer {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function decryptCredential(envelope: string, base64UrlKey: string): Promise<string> {
  const [version, encodedIv, encodedCiphertext, ...extra] = envelope.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || extra.length > 0) {
    throw new Error("Unsupported credential envelope");
  }
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(base64UrlToBytes(base64UrlKey)), "AES-GCM", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(base64UrlToBytes(encodedIv)) },
    key,
    toArrayBuffer(base64UrlToBytes(encodedCiphertext)),
  );
  return textDecoder.decode(plaintext);
}

export async function encryptCredential(plaintext: string, base64UrlKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(base64UrlToBytes(base64UrlKey)), "AES-GCM", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));
  return `v1.${btoa(String.fromCharCode(...iv)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}.${btoa(String.fromCharCode(...new Uint8Array(ciphertext))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`;
}

export function buildUpstreamHeaders(
  inbound: Headers | Record<string, string>,
  accessToken: string,
  accountId: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of toHeaderEntries(inbound)) {
    const normalized = name.toLowerCase();
    if (BLOCKED_INBOUND_HEADERS.has(normalized) || normalized.startsWith("x-forwarded-") || normalized.startsWith("cf-")) continue;
    headers[name] = value;
  }
  headers.Authorization = `Bearer ${accessToken}`;
  headers.Accept = "text/event-stream";
  headers["Content-Type"] = "application/json";
  if (accountId) headers["chatgpt-account-id"] = accountId;
  return headers;
}

export function parseCompletedResponse(sse: string): unknown | null {
  for (const event of sse.replace(/\r\n/g, "\n").split("\n\n")) {
    const data = event
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      const payload = JSON.parse(data) as { type?: unknown; response?: unknown };
      if (payload.type === "response.completed" && payload.response && typeof payload.response === "object") {
        return payload.response;
      }
    } catch {
      // Ignore malformed non-terminal frames and continue searching for completion.
    }
  }
  return null;
}

export function validateResponsePayload(payload: unknown): payload is Record<string, unknown> {
  return Boolean(payload && typeof payload === "object" && !Array.isArray(payload) && "model" in payload && "input" in payload);
}

export function retryAfterDeadline(retryAfter: string | null, nowEpoch = Math.floor(Date.now() / 1000)): number {
  const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
  const delay = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 30;
  return nowEpoch + Math.min(delay, 3600);
}

export function mayFailoverBeforeVisibleOutput(payload: Record<string, unknown>, upstreamStatus: number): boolean {
  return payload.stream !== true && upstreamStatus === 429;
}

export async function sessionKeyHash(sessionId: string | null): Promise<string | null> {
  if (!sessionId || sessionId.length > 512) return null;
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(sessionId));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function apiKeyHash(apiKey: string | null): Promise<string | null> {
  if (!apiKey?.startsWith("sk-clb-") || apiKey.length > 512) return null;
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(apiKey));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
