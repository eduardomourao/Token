const CODE_ASSIST_URL = "https://cloudcode-pa.googleapis.com/v1internal";

const LATEST_TRACKS = [
  ["pro_latest", "Pro Latest", ["gemini-3.1-pro-preview", "gemini-3-pro-preview", "gemini-2.5-pro"]],
  [
    "flash_latest",
    "Flash Latest",
    ["gemini-3.5-flash", "gemini-3.5-flash-preview", "gemini-3-flash-preview", "gemini-2.5-flash"],
  ],
  ["flash_lite_latest", "Flash-Lite Latest", ["gemini-3.1-flash-lite", "gemini-3.1-flash-lite-preview", "gemini-3-flash-lite"]],
] as const;

export type CollectorErrorCode = "invalid_credential" | "upstream_unavailable" | "invalid_payload" | "unknown";

export class CollectorError extends Error {
  constructor(readonly code: CollectorErrorCode, message: string) {
    super(message);
  }
}

export type GeminiUsageWindow = {
  windowKey: string;
  label: string;
  remainingPercent: number;
  resetsAt: string;
};

type GeminiCredentials = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
};

export function parseQuotaBuckets(payload: unknown): GeminiUsageWindow[] {
  if (!isRecord(payload) || !Array.isArray(payload.buckets)) {
    throw new CollectorError("invalid_payload", "Gemini returned an invalid quota payload");
  }

  const indexed = new Map<string, Record<string, unknown>>();
  for (const candidate of payload.buckets) {
    if (!isRecord(candidate) || typeof candidate.modelId !== "string") continue;
    const previous = indexed.get(candidate.modelId);
    if (!previous || String(candidate.tokenType ?? "").toUpperCase() === "REQUESTS") {
      indexed.set(candidate.modelId, candidate);
    }
  }

  const windows: GeminiUsageWindow[] = [];
  for (const [windowKey, label, modelIds] of LATEST_TRACKS) {
    const bucket = modelIds.map((modelId) => indexed.get(modelId)).find(isRecord);
    if (!bucket) continue;
    const fraction = Number(bucket.remainingFraction);
    const resetTime = typeof bucket.resetTime === "string" ? new Date(bucket.resetTime) : null;
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1 || !resetTime || Number.isNaN(resetTime.valueOf())) {
      throw new CollectorError("invalid_payload", "Gemini returned an invalid quota bucket");
    }
    windows.push({
      windowKey,
      label,
      remainingPercent: Math.round(fraction * 10000) / 100,
      resetsAt: resetTime.toISOString(),
    });
  }

  if (windows.length === 0) {
    throw new CollectorError("invalid_payload", "Gemini returned no supported quota buckets");
  }
  return windows;
}

export async function fetchGeminiUsage(credentials: GeminiCredentials): Promise<GeminiUsageWindow[]> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
  });
  if (!tokenResponse.ok) {
    throw new CollectorError(tokenResponse.status < 500 ? "invalid_credential" : "upstream_unavailable", "Gemini OAuth refresh failed");
  }
  const tokenPayload = await jsonRecord(tokenResponse, "upstream_unavailable");
  const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token.trim() : "";
  if (!accessToken) throw new CollectorError("invalid_payload", "Gemini OAuth returned no access token");

  const loaded = await postCodeAssist("loadCodeAssist", accessToken, {
    metadata: { ideType: "GEMINI_CLI", platform: "LINUX_AMD64", pluginType: "GEMINI" },
  });
  const project = projectId(loaded);
  const quota = await postCodeAssist("retrieveUserQuota", accessToken, { project });
  return parseQuotaBuckets(quota);
}

async function postCodeAssist(method: string, accessToken: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await fetch(`${CODE_ASSIST_URL}:${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new CollectorError("upstream_unavailable", "Gemini usage request failed");
  return jsonRecord(response, "invalid_payload");
}

function projectId(payload: Record<string, unknown>): string {
  const project = payload.cloudaicompanionProject;
  const value = isRecord(project) ? project.id ?? project.name : project;
  if (typeof value !== "string" || !value.trim()) {
    throw new CollectorError("invalid_payload", "Gemini returned no Cloud project");
  }
  return value.trim();
}

async function jsonRecord(response: Response, code: CollectorErrorCode): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) return body;
  } catch {
    // The caller receives a sanitized collector error below.
  }
  throw new CollectorError(code, "Gemini returned invalid JSON");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
