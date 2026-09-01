import { del, get, post, put } from "@/lib/api-client";
import { getSupabaseGeminiUsageMonitor, isSupabaseUsageMonitorEnabled } from "./supabase-usage-monitor";
import { GeminiUsageCredentialRequestSchema, GeminiUsageMonitorSchema } from "./schemas";

const PATH = "/api/gemini-usage";
export const getGeminiUsageMonitor = () => (
  isSupabaseUsageMonitorEnabled()
    ? getSupabaseGeminiUsageMonitor()
    : get(`${PATH}/`, GeminiUsageMonitorSchema)
);
export const configureGeminiUsage = (refreshToken: string) => put(`${PATH}/configuration`, GeminiUsageMonitorSchema, { body: GeminiUsageCredentialRequestSchema.parse({ refreshToken }) });
export const refreshGeminiUsage = () => post(`${PATH}/refresh`, GeminiUsageMonitorSchema);
export const clearGeminiUsage = () => del(`${PATH}/configuration`);
