const OPENCODE_GO_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const WINDOWS = ["rolling", "weekly", "monthly"] as const;

export type CollectorErrorCode = "invalid_credential" | "upstream_unavailable" | "invalid_payload" | "unknown";

export class CollectorError extends Error {
  constructor(readonly code: CollectorErrorCode, message: string) {
    super(message);
  }
}

export type OpenCodeUsageWindow = {
  windowKey: (typeof WINDOWS)[number];
  remainingPercent: number;
  resetsAt: string;
};

export function parseOpenCodeUsagePayload(payload: unknown): OpenCodeUsageWindow[] {
  if (!isRecord(payload)) {
    throw new CollectorError("invalid_payload", "OpenCode Go returned an invalid usage payload");
  }
  const usage = payload.usage;
  if (!isRecord(usage)) throw new CollectorError("invalid_payload", "OpenCode Go returned an invalid usage payload");

  return WINDOWS.map((windowKey) => {
    const entry = usage[windowKey];
    if (!isRecord(entry) || entry.status !== "ok") {
      throw new CollectorError("invalid_payload", "OpenCode Go usage is unavailable");
    }
    const remainingPercent = Number(entry.percent);
    const resetsAt = typeof entry.resetsAt === "string" ? new Date(entry.resetsAt) : null;
    if (!Number.isFinite(remainingPercent) || remainingPercent < 0 || remainingPercent > 100 || !resetsAt || Number.isNaN(resetsAt.valueOf())) {
      throw new CollectorError("invalid_payload", "OpenCode Go returned an invalid usage window");
    }
    return { windowKey, remainingPercent, resetsAt: resetsAt.toISOString() };
  });
}

export async function fetchOpenCodeUsage(apiKey: string): Promise<OpenCodeUsageWindow[]> {
  const response = await fetch(OPENCODE_GO_USAGE_URL, { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" } });
  if (!response.ok) {
    throw new CollectorError(response.status === 401 || response.status === 403 ? "invalid_credential" : "upstream_unavailable", "OpenCode Go usage request failed");
  }
  try {
    return parseOpenCodeUsagePayload(await response.json());
  } catch (error) {
    if (error instanceof CollectorError) throw error;
    throw new CollectorError("invalid_payload", "OpenCode Go returned invalid JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
