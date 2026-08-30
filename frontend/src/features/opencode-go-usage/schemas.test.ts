import { describe, expect, it } from "vitest";

import { OpenCodeGoUsageMonitorSchema } from "@/features/opencode-go-usage/schemas";

describe("OpenCodeGoUsageMonitorSchema", () => {
  it("parses the dedicated monitor response without a credential field", () => {
    const parsed = OpenCodeGoUsageMonitorSchema.parse({
      configured: true,
      lastAttemptAt: "2026-08-29T12:00:00Z",
      lastSuccessAt: "2026-08-29T12:00:00Z",
      lastError: null,
      windows: [
        {
          window: "rolling",
          remainingPercent: 75.5,
          usedPercent: 24.5,
          resetsAt: "2026-08-29T14:00:00Z",
          capturedAt: "2026-08-29T12:00:00Z",
        },
      ],
    });

    expect(parsed.windows[0]?.remainingPercent).toBe(75.5);
    expect("apiKey" in parsed).toBe(false);
  });
});
