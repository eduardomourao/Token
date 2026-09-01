import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

import { CollectorError, fetchOpenCodeUsage } from "./collector.ts";

const json = (status: number, payload: Record<string, unknown>) => Response.json(payload, { status });

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
    const collectorSecret = requiredEnv("USAGE_MONITOR_COLLECTOR_SECRET");
    if (!collectorSecret || !(await constantTimeEqual(request.headers.get("x-collector-secret"), collectorSecret))) {
      return json(401, { error: "unauthorized" });
    }
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const ownerId = requiredEnv("USAGE_MONITOR_OWNER_ID");
    const apiKey = requiredEnv("OPENCODE_GO_API_KEY");
    if (!supabaseUrl || !serviceRoleKey || !ownerId || !apiKey) return json(503, { error: "collector_not_configured" });

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: monitor, error: monitorError } = await admin
      .from("usage_monitors")
      .select("id, owner_id")
      .eq("owner_id", ownerId)
      .eq("provider", "opencode_go")
      .eq("enabled", true)
      .maybeSingle();
    if (monitorError) return json(500, { error: "monitor_query_failed" });
    if (!monitor) return json(404, { error: "monitor_not_found" });

    const now = new Date();
    const attemptedAt = now.toISOString();
    const collectionSlot = new Date(Math.floor(now.valueOf() / 60_000) * 60_000).toISOString();
    const { data: claimed, error: claimError } = await admin.rpc("claim_usage_collection", {
      p_monitor_id: monitor.id,
      p_owner_id: ownerId,
      p_provider: "opencode_go",
      p_collection_slot: collectionSlot,
    });
    const collection = claimed?.[0];
    if (claimError || !collection) return json(500, { error: "collection_claim_failed" });
    if (!collection.is_claimed) return json(200, { status: collection.collection_status === "succeeded" ? "already_collected" : "collection_in_progress" });

    try {
      const windows = await fetchOpenCodeUsage(apiKey);
      const { error: snapshotError } = await admin.from("usage_snapshots").upsert(
        windows.map((window) => ({
          collection_id: collection.collection_id,
          monitor_id: monitor.id,
          owner_id: ownerId,
          window_key: window.windowKey,
          label: window.windowKey,
          remaining_percent: window.remainingPercent,
          resets_at: window.resetsAt,
          captured_at: attemptedAt,
        })),
        { onConflict: "collection_id,window_key" },
      );
      if (snapshotError) throw new CollectorError("unknown", "snapshot_write_failed");
      const { error: completeError } = await admin.rpc("complete_usage_collection", {
        p_collection_id: collection.collection_id,
        p_monitor_id: monitor.id,
        p_owner_id: ownerId,
        p_attempted_at: attemptedAt,
      });
      if (completeError) return json(500, { error: "collection_finalize_failed" });
      return json(200, { status: "collected", windows: windows.length });
    } catch (error) {
      const code = error instanceof CollectorError ? error.code : "unknown";
      await admin.rpc("fail_usage_collection", {
        p_collection_id: collection.collection_id,
        p_monitor_id: monitor.id,
        p_owner_id: ownerId,
        p_attempted_at: attemptedAt,
        p_error_code: code,
      });
      return json(code === "invalid_credential" ? 401 : 502, { error: code });
    }
  },
};

function requiredEnv(name: string): string | null {
  const value = Deno.env.get(name)?.trim();
  return value || null;
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
