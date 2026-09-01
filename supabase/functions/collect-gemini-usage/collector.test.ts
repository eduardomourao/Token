import { assertEquals, assertThrows } from "jsr:@std/assert@^1";

import { parseQuotaBuckets } from "./collector.ts";

Deno.test("parseQuotaBuckets prefers request quota and emits supported latest tracks", () => {
  const buckets = parseQuotaBuckets({
    buckets: [
      {
        modelId: "gemini-2.5-pro",
        tokenType: "TOKENS",
        remainingFraction: 0.2,
        resetTime: "2026-09-01T12:00:00Z",
      },
      {
        modelId: "gemini-2.5-pro",
        tokenType: "REQUESTS",
        remainingFraction: 0.75,
        resetTime: "2026-09-01T13:00:00Z",
      },
      {
        modelId: "gemini-3.1-flash-lite",
        remainingFraction: 0.5,
        resetTime: "2026-09-01T14:00:00Z",
      },
    ],
  });

  assertEquals(buckets, [
    {
      windowKey: "pro_latest",
      label: "Pro Latest",
      remainingPercent: 75,
      resetsAt: "2026-09-01T13:00:00.000Z",
    },
    {
      windowKey: "flash_lite_latest",
      label: "Flash-Lite Latest",
      remainingPercent: 50,
      resetsAt: "2026-09-01T14:00:00.000Z",
    },
  ]);
});

Deno.test("parseQuotaBuckets rejects a malformed or unsupported quota response", () => {
  assertThrows(() => parseQuotaBuckets({ buckets: [] }), Error, "supported quota buckets");
  assertThrows(
    () => parseQuotaBuckets({ buckets: [{ modelId: "gemini-2.5-pro", remainingFraction: 2, resetTime: "x" }] }),
    Error,
    "invalid quota bucket",
  );
});
