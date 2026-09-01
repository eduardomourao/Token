import { del, get, post, put } from "@/lib/api-client";
import {
  OpenCodeGoUsageCredentialRequestSchema,
  OpenCodeGoUsageMonitorSchema,
} from "@/features/opencode-go-usage/schemas";
import { getSupabaseOpenCodeGoUsageMonitor, isSupabaseUsageMonitorEnabled } from "@/features/gemini-usage/supabase-usage-monitor";

const OPENCODE_GO_USAGE_PATH = "/api/opencode-go-usage";

export function getOpenCodeGoUsageMonitor() {
  return isSupabaseUsageMonitorEnabled()
    ? getSupabaseOpenCodeGoUsageMonitor()
    : get(`${OPENCODE_GO_USAGE_PATH}/`, OpenCodeGoUsageMonitorSchema);
}

export function configureOpenCodeGoUsage(apiKey: string) {
  const payload = OpenCodeGoUsageCredentialRequestSchema.parse({ apiKey });
  return put(`${OPENCODE_GO_USAGE_PATH}/configuration`, OpenCodeGoUsageMonitorSchema, { body: payload });
}

export function refreshOpenCodeGoUsage() {
  return post(`${OPENCODE_GO_USAGE_PATH}/refresh`, OpenCodeGoUsageMonitorSchema);
}

export function clearOpenCodeGoUsage() {
  return del(`${OPENCODE_GO_USAGE_PATH}/configuration`);
}

export async function downloadOpenCodeGoUsageCsv(): Promise<Blob> {
  const response = await fetch(`${OPENCODE_GO_USAGE_PATH}/history.csv`, {
    credentials: "same-origin",
    headers: { Accept: "text/csv" },
  });
  if (!response.ok) {
    throw new Error("OpenCode Go usage history download failed");
  }
  return response.blob();
}
