import { del, get, post, put } from "@/lib/api-client";
import { AntigravityUsageCredentialRequestSchema, AntigravityUsageMonitorSchema } from "./schemas";

const PATH = "/api/antigravity-usage";
export const getAntigravityUsageMonitor = () => get(`${PATH}/`, AntigravityUsageMonitorSchema);
export const configureAntigravityUsage = (refreshToken: string) => put(`${PATH}/configuration`, AntigravityUsageMonitorSchema, { body: AntigravityUsageCredentialRequestSchema.parse({ refreshToken }) });
export const refreshAntigravityUsage = () => post(`${PATH}/refresh`, AntigravityUsageMonitorSchema);
export const clearAntigravityUsage = () => del(`${PATH}/configuration`);
