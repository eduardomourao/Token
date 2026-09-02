import { experimental_upgradeWebSocket, type WebSocket } from "@vercel/functions";

import { HOSTED_WEBSOCKET_MAX_FRAME_BYTES } from "./_lib/hosted-websocket";

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

function requestHeaders(headers: Record<string, HeaderValue>): Headers {
  const normalized = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") normalized.set(name, value);
    else if (Array.isArray(value) && value.length > 0) normalized.set(name, value.join(", "));
  }
  return normalized;
}

function safeClose(socket: WebSocket): void {
  try {
    socket.send(JSON.stringify({
      type: "error",
      error: { code: "hosted_websocket_probe_only", message: "This hosted WebSocket route is a compatibility probe." },
    }));
    socket.close(1008, "Hosted WebSocket probe only");
  } catch {
    // The peer may have closed while the probe was responding.
  }
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
      socket.send(JSON.stringify({ type: "hosted.websocket.probe" }));
      socket.once("message", () => safeClose(socket));
    }, { maxPayload: HOSTED_WEBSOCKET_MAX_FRAME_BYTES });
  } catch {
    response.status(503).json({ error: "websocket_unavailable" });
  }
}
