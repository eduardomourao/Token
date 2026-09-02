import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

import { decryptCredential } from "../proxy-responses/proxy.ts";
import { ChatGPTUsageError, parseChatGPTUsagePayload } from "./collector.ts";

const USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";

type RefreshAccount = {
  legacy_account_id: string;
  chatgpt_account_id: string | null;
  access_token_ciphertext: string;
};

const json = (status: number, payload: Record<string, unknown>) => Response.json(payload, { status, headers: { "cache-control": "no-store" } });

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

    const collectorSecret = requiredEnv("USAGE_MONITOR_COLLECTOR_SECRET");
    if (!collectorSecret || !(await constantTimeEqual(request.headers.get("x-collector-secret"), collectorSecret))) {
      return json(401, { error: "unauthorized" });
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = serviceRoleKeyFromEnv();
    const ownerId = requiredEnv("USAGE_MONITOR_OWNER_ID");
    const credentialKey = requiredEnv("HOSTED_PROXY_CREDENTIAL_KEY");
    if (!supabaseUrl || !serviceRoleKey || !ownerId || !credentialKey) return json(503, { error: "collector_not_configured" });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.rpc("hosted_proxy_accounts_for_usage_refresh", { requested_owner_id: ownerId });
    if (error) return json(503, { error: "proxy_storage_unavailable" });
    const accounts = Array.isArray(data) ? data as RefreshAccount[] : [];

    let refreshed = 0;
    let failed = 0;
    let reauthRequired = 0;
    for (const account of accounts) {
      try {
        const accessToken = await decryptCredential(account.access_token_ciphertext, credentialKey);
        const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
        if (account.chatgpt_account_id && !account.chatgpt_account_id.startsWith("email_") && !account.chatgpt_account_id.startsWith("local_")) {
          headers["chatgpt-account-id"] = account.chatgpt_account_id;
        }
        const upstream = await fetch(USAGE_URL, { headers });
        if (upstream.status === 401) {
          await admin.rpc("hosted_proxy_mark_reauth_required", {
            requested_owner_id: ownerId,
            requested_legacy_account_id: account.legacy_account_id,
          });
          reauthRequired += 1;
          continue;
        }
        if (!upstream.ok) {
          failed += 1;
          continue;
        }
        const windows = parseChatGPTUsagePayload(await upstream.json());
        const recordedAt = new Date().toISOString();
        const { error: writeError } = await admin.from("hosted_dashboard_usage_history").insert(
          windows.map((window) => ({
            owner_id: ownerId,
            legacy_account_id: account.legacy_account_id,
            recorded_at: recordedAt,
            window_key: window.windowKey,
            used_percent: window.usedPercent,
            reset_at: window.resetAt,
            window_minutes: window.windowMinutes,
            credits_has: window.creditsHas,
            credits_unlimited: window.creditsUnlimited,
            credits_balance: window.creditsBalance,
          })),
        );
        if (writeError) throw new ChatGPTUsageError("upstream_unavailable", "usage_write_failed");
        const { error: refreshError } = await admin.rpc("hosted_proxy_record_usage_refresh", {
          requested_owner_id: ownerId,
          requested_legacy_account_id: account.legacy_account_id,
        });
        if (refreshError) throw new ChatGPTUsageError("upstream_unavailable", "account_refresh_write_failed");
        refreshed += 1;
      } catch {
        failed += 1;
      }
    }
    return json(200, { status: "refreshed", refreshed, failed, reauth_required: reauthRequired });
  },
};

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
}

function serviceRoleKeyFromEnv(): string | null {
  const legacy = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const encoded = requiredEnv("SUPABASE_SECRET_KEYS");
  if (!encoded) return null;
  try {
    const keys = JSON.parse(encoded) as Record<string, unknown>;
    return typeof keys.default === "string" && keys.default ? keys.default : null;
  } catch {
    return null;
  }
}

async function constantTimeEqual(received: string | null, expected: string): Promise<boolean> {
  if (!received) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(received)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}
