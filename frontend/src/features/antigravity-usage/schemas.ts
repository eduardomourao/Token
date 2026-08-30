import { z } from "zod";

export const AntigravityUsageWindowSchema = z.object({
  group: z.enum(["gemini", "claude_gpt"]), windowKind: z.enum(["five_hour", "weekly", "unknown"]), label: z.string(), remainingPercent: z.number().min(0).max(100), usedPercent: z.number().min(0).max(100),
  resetsAt: z.string().datetime({ offset: true }), capturedAt: z.string().datetime({ offset: true }),
});
export const AntigravityUsageMonitorSchema = z.object({
  configured: z.boolean(), lastAttemptAt: z.string().datetime({ offset: true }).nullable(), lastSuccessAt: z.string().datetime({ offset: true }).nullable(), lastError: z.string().nullable(), windows: z.array(AntigravityUsageWindowSchema),
});
export const AntigravityUsageCredentialRequestSchema = z.object({ refreshToken: z.string().trim().min(1) });
export type AntigravityUsageMonitor = z.infer<typeof AntigravityUsageMonitorSchema>;
