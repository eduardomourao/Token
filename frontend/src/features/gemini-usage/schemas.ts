import { z } from "zod";

export const GeminiUsageWindowSchema = z.object({
  window: z.string(), label: z.string(), remainingPercent: z.number().min(0).max(100), usedPercent: z.number().min(0).max(100),
  resetsAt: z.string().datetime({ offset: true }), capturedAt: z.string().datetime({ offset: true }),
});
export const GeminiUsageMonitorSchema = z.object({
  configured: z.boolean(), lastAttemptAt: z.string().datetime({ offset: true }).nullable(), lastSuccessAt: z.string().datetime({ offset: true }).nullable(), lastError: z.string().nullable(), windows: z.array(GeminiUsageWindowSchema),
});
export const GeminiUsageCredentialRequestSchema = z.object({ refreshToken: z.string().trim().min(1) });
export type GeminiUsageMonitor = z.infer<typeof GeminiUsageMonitorSchema>;
