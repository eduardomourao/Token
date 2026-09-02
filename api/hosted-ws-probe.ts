import { randomUUID } from "node:crypto";
import { experimental_upgradeWebSocket, type WebSocket } from "@vercel/functions";

import { HOSTED_WEBSOCKET_MAX_FRAME_BYTES, HostedResponsesSseDecoder, parseHostedResponseCreate } from "./_lib/hosted-websocket";

const EDGE_FUNCTION_URL = "https://mtokqhqdkkxbyvgjwyvu.supabase.co/functions/v1/proxy-responses";

type HeaderValue = string | string[] | undefined;
type NodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
};
type NodeResponse = {
  status(code: number): NodeResponse;
  json(payload: Record<string, unknown>): void;
};

export const config = { runtime: "nodejs" };

export function isHostedWebSocketUpgrade(request: Request): boolean {
  return request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket";
}

export function buildHostedWebSocketPreflightHeaders(headers: Headers): Record<string, string> {
  const authorization = headers.get("x-supabase-authorization") ?? headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("authorization bearer credential is required");
  return {
    authorization,
    "x-codex-websocket-auth-check": "1",
  };
}

export function buildHostedWebSocketSpoolHeaders(headers: Headers, action: "create" | "append"): Record<string, string> {
  const authorization = headers.get("x-supabase-authorization") ?? headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("authorization bearer credential is required");
  return {
    authorization,
    "content-type": "application/json",
    "x-codex-websocket-spool-action": action,
  };
}

export function classifyHostedRelayFailure(detail: unknown): "input_must_be_list" | "store_must_be_false" | "upstream_rejected" {
  if (detail === "Input must be a list") return "input_must_be_list";
  if (detail === "Store must be set to false") return "store_must_be_false";
  return "upstream_rejected";
}

async function hostedRelayFailure(response: Response): Promise<ReturnType<typeof classifyHostedRelayFailure>> {
  try {
    const payload = JSON.parse(await response.text()) as { detail?: unknown };
    return classifyHostedRelayFailure(payload.detail);
  } catch {
    return "upstream_rejected";
  }
}

function requestHeaders(headers: Record<string, HeaderValue>): Headers {
  const normalized = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") normalized.set(name, value);
    else if (Array.isArray(value) && value.length > 0) normalized.set(name, value.join(", "));
  }
  return normalized;
}

function safeClose(socket: WebSocket, code: string, message: string): void {
  try {
    socket.send(JSON.stringify({
      type: "error",
      error: { code, message },
    }));
    socket.close(1008, "Hosted WebSocket probe only");
  } catch {
    // The peer may have closed while the probe was responding.
  }
}

function relayHeaders(headers: Headers): Record<string, string> {
  const authorization = headers.get("x-supabase-authorization") ?? headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new Error("authorization bearer credential is required");
  const result = { authorization, "content-type": "application/json" };
  const sessionId = headers.get("x-codex-session-id");
  return sessionId && sessionId.length <= 512 ? { ...result, "x-codex-session-id": sessionId } : result;
}

async function spool(headers: Headers, action: "create" | "append", payload: Record<string, unknown>): Promise<Response> {
  return fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: buildHostedWebSocketSpoolHeaders(headers, action),
    body: JSON.stringify(payload),
  });
}

function isTerminal(frame: string): boolean {
  try {
    const type = (JSON.parse(frame) as { type?: unknown }).type;
    return type === "response.completed" || type === "response.failed" || type === "response.incomplete" || type === "error";
  } catch { return false; }
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const headers = requestHeaders(request.headers);
  const upgradeRequest = new Request("https://token-usage-monitor.vercel.app/api/hosted-ws-probe", {
    method: request.method ?? "GET",
    headers,
  });
  if (!isHostedWebSocketUpgrade(upgradeRequest)) {
    response.status(426).json({ error: "upgrade_required" });
    return;
  }

  let preflightHeaders: Record<string, string>;
  try {
    preflightHeaders = buildHostedWebSocketPreflightHeaders(headers);
  } catch {
    response.status(401).json({ error: "unauthorized" });
    return;
  }

  let preflight: Response;
  try {
    preflight = await fetch(EDGE_FUNCTION_URL, { method: "POST", headers: preflightHeaders });
  } catch {
    response.status(502).json({ error: "proxy_unavailable" });
    return;
  }
  if (!preflight.ok) {
    response.status(preflight.status === 401 ? 401 : 502).json({ error: preflight.status === 401 ? "unauthorized" : "proxy_unavailable" });
    return;
  }

  try {
    await experimental_upgradeWebSocket((socket) => {
      let active = false;
      socket.on("message", async (data, isBinary) => {
        if (isBinary || active) { safeClose(socket, "invalid_client_frame", "Hosted gateway accepts one text response.create at a time."); return; }
        const parsed = parseHostedResponseCreate(data.toString());
        if (parsed.ok === false) {
          if (parsed.error === "ignored_client_frame") return;
          safeClose(socket, parsed.error, "Invalid Responses WebSocket frame.");
          return;
        }
        active = true;
        const spoolId = randomUUID();
        let stage = "spool_create";
        try {
          const createdSpool = await spool(headers, "create", { spool_id: spoolId });
          if (!createdSpool.ok) {
            console.error("hosted_ws_probe_failed", { stage, status: createdSpool.status });
            throw new Error("spool create failed");
          }
          stage = "relay";
          const upstream = await fetch(EDGE_FUNCTION_URL, { method: "POST", headers: relayHeaders(headers), body: JSON.stringify(parsed.payload) });
          if (!upstream.ok || !upstream.body) {
            console.error("hosted_ws_probe_failed", { stage, status: upstream.status, reason: await hostedRelayFailure(upstream) });
            throw new Error("relay failed");
          }
          const decoder = new HostedResponsesSseDecoder();
          const reader = upstream.body.getReader();
          const textDecoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            for (const frame of decoder.push(textDecoder.decode(value, { stream: true }))) {
              stage = "spool_append";
              const appendedEvent = await spool(headers, "append", { spool_id: spoolId, event_frame: JSON.parse(frame), is_terminal: isTerminal(frame) });
              if (!appendedEvent.ok) {
                console.error("hosted_ws_probe_failed", { stage, status: appendedEvent.status });
                throw new Error("spool append failed");
              }
              socket.send(frame);
              if (isTerminal(frame)) active = false;
            }
          }
        } catch {
          safeClose(socket, "hosted_gateway_failed", "Hosted WebSocket gateway could not complete the request.");
        }
      });
    }, { maxPayload: HOSTED_WEBSOCKET_MAX_FRAME_BYTES });
  } catch {
    response.status(503).json({ error: "websocket_unavailable" });
  }
}
