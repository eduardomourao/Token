import { assertEquals, assertThrows } from "jsr:@std/assert@^1";

import { parseOpenCodeUsagePayload } from "./collector.ts";

Deno.test("parseOpenCodeUsagePayload maps all supported usage windows", () => {
  const windows = parseOpenCodeUsagePayload({
    usage: {
      rolling: { status: "ok", percent: 90, resetsAt: "2026-09-01T12:00:00Z" },
      weekly: { status: "ok", percent: 60.5, resetsAt: "2026-09-02T12:00:00Z" },
      monthly: { status: "ok", percent: 10, resetsAt: "2026-10-01T12:00:00Z" },
    },
  });

  assertEquals(windows.map((window) => window.windowKey), ["rolling", "weekly", "monthly"]);
  assertEquals(windows[1].remainingPercent, 60.5);
});

Deno.test("parseOpenCodeUsagePayload rejects missing or non-ok windows", () => {
  assertThrows(() => parseOpenCodeUsagePayload({ usage: {} }), Error, "unavailable");
  assertThrows(() => parseOpenCodeUsagePayload({ usage: { rolling: { status: "ok", percent: 101, resetsAt: "2026-09-01T12:00:00Z" } } }), Error);
});
