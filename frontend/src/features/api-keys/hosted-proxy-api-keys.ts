import { getSupabaseUsageMonitorClient } from "@/features/gemini-usage/supabase-usage-monitor";

export type HostedProxyApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  last_used_at: string | null;
};

type ApiKeysResponse = { apiKeys: HostedProxyApiKey[] };
type CreatedApiKeyResponse = { apiKey: HostedProxyApiKey; key: string };

async function invoke<T>(method: "GET" | "POST", body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabaseUsageMonitorClient().functions.invoke("proxy-api-keys", {
    method,
    body,
  });
  if (error) throw error;
  return data as T;
}

export async function listHostedProxyApiKeys(): Promise<HostedProxyApiKey[]> {
  return (await invoke<ApiKeysResponse>("GET")).apiKeys;
}

export async function createHostedProxyApiKey(name: string): Promise<CreatedApiKeyResponse> {
  return invoke<CreatedApiKeyResponse>("POST", { action: "create", name });
}

export async function revokeHostedProxyApiKey(id: string): Promise<void> {
  await invoke<{ revoked: boolean }>("POST", { action: "revoke", id });
}
