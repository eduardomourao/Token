import { assertEquals, assertThrows } from "jsr:@std/assert@^1";

import { ChatGPTUsageError, parseChatGPTUsagePayload } from "./collector.ts";

Deno.test("parseChatGPTUsagePayload maps primary and secondary quota windows", () => {
  const windows = parseChatGPTUsagePayload({
    credits: { has_credits: true, unlimited: false, balance: "12.5" },
    rate_limit: {
      primary_window: { used_percent: 25, reset_after_seconds: 300, limit_window_seconds: 18_000 },
      secondary_window: { used_percent: 50, reset_at: 1_800_000_000, limit_window_seconds: 604_800 },
    },
  }, 1_700_000_000);

  assertEquals(windows, [
    { windowKey: "primary", usedPercent: 25, resetAt: 1_700_000_300, windowMinutes: 300, creditsHas: true, creditsUnlimited: false, creditsBalance: 12.5 },
    { windowKey: "secondary", usedPercent: 50, resetAt: 1_800_000_000, windowMinutes: 10_080, creditsHas: null, creditsUnlimited: null, creditsBalance: null },
  ]);
});

Deno.test("parseChatGPTUsagePayload maps a standalone 30-day window to monthly", () => {
  const windows = parseChatGPTUsagePayload({
    rate_limit: { primary_window: { used_percent: 5, reset_at: 1_800_000_000, limit_window_seconds: 2_592_000 } },
  });

  assertEquals(windows[0].windowKey, "monthly");
});

Deno.test("parseChatGPTUsagePayload rejects a missing or invalid quota response", () => {
  assertThrows(() => parseChatGPTUsagePayload({}), ChatGPTUsageError, "missing rate limits");
  assertThrows(() => parseChatGPTUsagePayload({ rate_limit: { primary_window: { used_percent: 101 } } }), ChatGPTUsageError, "percentage");
});
