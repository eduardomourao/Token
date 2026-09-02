export type ChatGPTUsageWindow = {
  windowKey: "primary" | "secondary" | "monthly";
  usedPercent: number;
  resetAt: number | null;
  windowMinutes: number | null;
  creditsHas: boolean | null;
  creditsUnlimited: boolean | null;
  creditsBalance: number | null;
};

const MONTHLY_WINDOW_SECONDS = 43_200 * 60;

export class ChatGPTUsageError extends Error {
  constructor(readonly code: "invalid_payload" | "upstream_unavailable", message: string) {
    super(message);
  }
}

export function parseChatGPTUsagePayload(payload: unknown, nowEpoch = Math.floor(Date.now() / 1000)): ChatGPTUsageWindow[] {
  if (!isRecord(payload) || !isRecord(payload.rate_limit)) {
    throw new ChatGPTUsageError("invalid_payload", "ChatGPT usage payload is missing rate limits");
  }

  const rateLimit = payload.rate_limit;
  const primary = parseWindow(rateLimit.primary_window, "primary", nowEpoch, payload.credits);
  const secondary = parseWindow(rateLimit.secondary_window, "secondary", nowEpoch, undefined);
  if (!primary && !secondary) throw new ChatGPTUsageError("invalid_payload", "ChatGPT usage payload has no usable windows");

  if (primary?.windowMinutes === 43_200 && !secondary) {
    return [{ ...primary, windowKey: "monthly" }];
  }
  return [primary, secondary].filter((window): window is ChatGPTUsageWindow => window !== null);
}

function parseWindow(
  value: unknown,
  windowKey: "primary" | "secondary",
  nowEpoch: number,
  credits: unknown,
): ChatGPTUsageWindow | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new ChatGPTUsageError("invalid_payload", "ChatGPT usage window is invalid");
  const usedPercent = Number(value.used_percent);
  if (!Number.isFinite(usedPercent) || usedPercent < 0 || usedPercent > 100) {
    throw new ChatGPTUsageError("invalid_payload", "ChatGPT usage percentage is invalid");
  }
  const resetAtValue = optionalFiniteNumber(value.reset_at);
  const resetAfterSeconds = optionalFiniteNumber(value.reset_after_seconds);
  const limitWindowSeconds = optionalFiniteNumber(value.limit_window_seconds);
  return {
    windowKey,
    usedPercent,
    resetAt: resetAtValue === null ? resetAfterSeconds === null ? null : nowEpoch + Math.max(0, Math.floor(resetAfterSeconds)) : Math.floor(resetAtValue),
    windowMinutes: limitWindowSeconds === null || limitWindowSeconds <= 0 ? null : Math.max(1, Math.ceil(limitWindowSeconds / 60)),
    creditsHas: windowKey === "primary" && isRecord(credits) && typeof credits.has_credits === "boolean" ? credits.has_credits : null,
    creditsUnlimited: windowKey === "primary" && isRecord(credits) && typeof credits.unlimited === "boolean" ? credits.unlimited : null,
    creditsBalance: windowKey === "primary" && isRecord(credits) ? optionalFiniteNumber(credits.balance) : null,
  };
}

function optionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
