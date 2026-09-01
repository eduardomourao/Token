import { describe, expect, it } from "vitest";

import { mapSupabaseGeminiUsageMonitor } from "./supabase-usage-monitor";

describe("mapSupabaseGeminiUsageMonitor", () => {
  it("returns an unconfigured monitor when the authenticated owner has no Gemini monitor", () => {
    expect(mapSupabaseGeminiUsageMonitor(null, [])).toEqual({
      configured: false,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      windows: [],
    });
  });

  it("keeps only the newest snapshot for each monitor window and normalizes numeric values", () => {
    const monitor = {
      id: "monitor-1",
      last_attempt_at: "2026-09-01T14:00:00+00:00",
      last_success_at: "2026-09-01T14:00:00+00:00",
      last_error_code: null,
    };
    const snapshots = [
      {
        window_key: "pro_latest",
        label: "Gemini Pro",
        remaining_percent: "74.5",
        used_percent: "25.5",
        resets_at: "2026-09-01T15:00:00+00:00",
        captured_at: "2026-09-01T14:00:00+00:00",
      },
      {
        window_key: "pro_latest",
        label: "Gemini Pro",
        remaining_percent: "60",
        used_percent: "40",
        resets_at: "2026-09-01T14:30:00+00:00",
        captured_at: "2026-09-01T13:00:00+00:00",
      },
    ];

    expect(mapSupabaseGeminiUsageMonitor(monitor, snapshots)).toEqual({
      configured: true,
      lastAttemptAt: "2026-09-01T14:00:00+00:00",
      lastSuccessAt: "2026-09-01T14:00:00+00:00",
      lastError: null,
      windows: [
        {
          window: "pro_latest",
          label: "Gemini Pro",
          remainingPercent: 74.5,
          usedPercent: 25.5,
          resetsAt: "2026-09-01T15:00:00+00:00",
          capturedAt: "2026-09-01T14:00:00+00:00",
        },
      ],
    });
  });
});
