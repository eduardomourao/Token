import { expect, test } from "bun:test";

import { ChatGPTUsageError, parseChatGPTUsagePayload } from "../../supabase/functions/refresh-proxy-usage/collector.ts";

test("maps ChatGPT primary and secondary usage windows without credential data", () => {
  expect(parseChatGPTUsagePayload({
    credits: { has_credits: true, unlimited: false, balance: "12.5" },
    rate_limit: {
      primary_window: { used_percent: 25, reset_after_seconds: 300, limit_window_seconds: 18_000 },
      secondary_window: { used_percent: 50, reset_at: 1_800_000_000, limit_window_seconds: 604_800 },
    },
  }, 1_700_000_000)).toEqual([
    { windowKey: "primary", usedPercent: 25, resetAt: 1_700_000_300, windowMinutes: 300, creditsHas: true, creditsUnlimited: false, creditsBalance: 12.5 },
    { windowKey: "secondary", usedPercent: 50, resetAt: 1_800_000_000, windowMinutes: 10_080, creditsHas: null, creditsUnlimited: null, creditsBalance: null },
  ]);
});

test("maps a standalone monthly quota and rejects malformed quota data", () => {
  expect(parseChatGPTUsagePayload({
    rate_limit: { primary_window: { used_percent: 5, reset_at: 1_800_000_000, limit_window_seconds: 2_592_000 } },
  })[0]?.windowKey).toBe("monthly");

  expect(() => parseChatGPTUsagePayload({})).toThrow(ChatGPTUsageError);
  expect(() => parseChatGPTUsagePayload({ rate_limit: { primary_window: { used_percent: 101 } } })).toThrow(ChatGPTUsageError);
});
