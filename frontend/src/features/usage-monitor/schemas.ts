import { z } from "zod";

export const OPENCODE_GO_SELECTION = "opencode-go" as const;
export const GEMINI_SELECTION = "gemini" as const;
export const ANTIGRAVITY_SELECTION = "antigravity" as const;
export const USAGE_MONITOR_SELECTION_STORAGE_KEY = "codex-lb-usage-monitor-selection";

export const UsageMonitorSelectionSchema = z.union([
  z.literal(OPENCODE_GO_SELECTION),
  z.literal(GEMINI_SELECTION),
  z.literal(ANTIGRAVITY_SELECTION),
  z.string().regex(/^account:[^\s]+$/),
]);

export type UsageMonitorSelection = z.infer<typeof UsageMonitorSelectionSchema>;

export function accountSelection(accountId: string): UsageMonitorSelection {
  return `account:${accountId}`;
}

export function selectedAccountId(selection: UsageMonitorSelection | null): string | null {
  return selection?.startsWith("account:") ? selection.slice("account:".length) : null;
}

export function readUsageMonitorSelection(): UsageMonitorSelection | null {
  if (typeof window === "undefined") return null;
  const parsed = UsageMonitorSelectionSchema.safeParse(
    window.localStorage.getItem(USAGE_MONITOR_SELECTION_STORAGE_KEY),
  );
  return parsed.success ? parsed.data : null;
}
