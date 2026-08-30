import { z } from "zod";

export const OpenCodeGoUsageWindowSchema = z.object({
  window: z.enum(["rolling", "weekly", "monthly"]),
  remainingPercent: z.number().min(0).max(100),
  usedPercent: z.number().min(0).max(100),
  resetsAt: z.string().datetime({ offset: true }),
  capturedAt: z.string().datetime({ offset: true }),
});

export const OpenCodeGoUsageMonitorSchema = z.object({
  configured: z.boolean(),
  lastAttemptAt: z.string().datetime({ offset: true }).nullable(),
  lastSuccessAt: z.string().datetime({ offset: true }).nullable(),
  lastError: z.string().nullable(),
  windows: z.array(OpenCodeGoUsageWindowSchema),
});

export const OpenCodeGoUsageCredentialRequestSchema = z.object({
  apiKey: z.string().trim().min(1),
});

export type OpenCodeGoUsageMonitor = z.infer<typeof OpenCodeGoUsageMonitorSchema>;
export type OpenCodeGoUsageCredentialRequest = z.infer<typeof OpenCodeGoUsageCredentialRequestSchema>;
export type OpenCodeGoUsageWindow = z.infer<typeof OpenCodeGoUsageWindowSchema>;
