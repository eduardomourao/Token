export type HostedHealthPayload = {
  status: "ok";
  checks?: Record<string, string>;
};

export function hostedHealthPayload(kind: "health" | "live" | "ready" | "startup"): HostedHealthPayload {
  if (kind === "health") return { status: "ok" };
  return { status: "ok", checks: { runtime: "vercel", proxy_transport: "http_sse" } };
}
