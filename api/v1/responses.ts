const EDGE_FUNCTION_URL = "https://mtokqhqdkkxbyvgjwyvu.supabase.co/functions/v1/proxy-responses";

type HeaderValue = string | string[] | undefined;
type NodeRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  body?: unknown;
};
type NodeResponse = {
  status(code: number): NodeResponse;
  setHeader(name: string, value: string): void;
  json(payload: Record<string, unknown>): void;
  write(chunk: Uint8Array): void;
  end(): void;
};

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
};

export function buildEdgeFunctionHeaders(headers: Record<string, HeaderValue>): Record<string, string> {
  const authorization = headers["x-supabase-authorization"] ?? headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    throw new Error("authorization bearer JWT is required");
  }
  return {
    authorization,
    "content-type": "application/json",
  };
}

function copyResponseHeaders(source: Headers, destination: NodeResponse): void {
  const contentType = source.get("content-type");
  if (contentType) destination.setHeader("content-type", contentType);
  const cacheControl = source.get("cache-control");
  if (cacheControl) destination.setHeader("cache-control", cacheControl);
  for (const [name, value] of source.entries()) {
    if (name.toLowerCase().startsWith("x-ratelimit-")) destination.setHeader(name, value);
  }
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  if (request.method !== "POST") {
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  let headers: Record<string, string>;
  try {
    headers = buildEdgeFunctionHeaders(request.headers);
  } catch {
    response.status(401).json({ error: "unauthorized" });
    return;
  }

  let upstream: Response;
  try {
    upstream = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(request.body ?? {}),
    });
  } catch {
    response.status(502).json({ error: "upstream_unavailable" });
    return;
  }

  response.status(upstream.status);
  copyResponseHeaders(upstream.headers, response);
  if (!upstream.body) {
    response.end();
    return;
  }
  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      response.write(value);
    }
  } finally {
    reader.releaseLock();
  }
  response.end();
}
