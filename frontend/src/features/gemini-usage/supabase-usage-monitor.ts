import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { GeminiUsageMonitor } from "./schemas";
import type { OpenCodeGoUsageMonitor } from "@/features/opencode-go-usage/schemas";

type SupabaseUsageMonitor = {
  id: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_error_code: string | null;
};

type SupabaseUsageSnapshot = {
  window_key: string;
  label: string;
  remaining_percent: number | string;
  used_percent: number | string;
  resets_at: string;
  captured_at: string;
};

type SupabaseUsageMonitorConfig = {
  url: string;
  publishableKey: string;
};

let client: SupabaseClient | null = null;

function readSupabaseUsageMonitorConfig(): SupabaseUsageMonitorConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  return url && publishableKey ? { url, publishableKey } : null;
}

export function isSupabaseUsageMonitorEnabled(): boolean {
  return readSupabaseUsageMonitorConfig() !== null;
}

export function getSupabaseUsageMonitorClient(): SupabaseClient {
  const config = readSupabaseUsageMonitorConfig();
  if (!config) throw new Error("Supabase usage monitor is not configured");
  if (client === null) client = createClient(config.url, config.publishableKey);
  return client;
}

export function mapSupabaseGeminiUsageMonitor(
  monitor: SupabaseUsageMonitor | null,
  snapshots: SupabaseUsageSnapshot[],
): GeminiUsageMonitor {
  if (!monitor) {
    return { configured: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null, windows: [] };
  }

  const newestSnapshots = new Map<string, SupabaseUsageSnapshot>();
  for (const snapshot of snapshots) {
    const current = newestSnapshots.get(snapshot.window_key);
    if (!current || current.captured_at < snapshot.captured_at) {
      newestSnapshots.set(snapshot.window_key, snapshot);
    }
  }

  const windows = [...newestSnapshots.values()]
    .sort((left, right) => left.window_key.localeCompare(right.window_key))
    .map((snapshot) => ({
      window: snapshot.window_key,
      label: snapshot.label,
      remainingPercent: Number(snapshot.remaining_percent),
      usedPercent: Number(snapshot.used_percent),
      resetsAt: snapshot.resets_at,
      capturedAt: snapshot.captured_at,
    }));

  return {
    configured: true,
    lastAttemptAt: monitor.last_attempt_at,
    lastSuccessAt: monitor.last_success_at,
    lastError: monitor.last_error_code,
    windows,
  };
}

export function mapSupabaseOpenCodeGoUsageMonitor(
  monitor: SupabaseUsageMonitor | null,
  snapshots: SupabaseUsageSnapshot[],
): OpenCodeGoUsageMonitor {
  if (!monitor) {
    return { configured: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null, windows: [] };
  }

  const newestSnapshots = new Map<string, SupabaseUsageSnapshot>();
  for (const snapshot of snapshots) {
    const current = newestSnapshots.get(snapshot.window_key);
    if (!current || current.captured_at < snapshot.captured_at) newestSnapshots.set(snapshot.window_key, snapshot);
  }

  const windows = ["rolling", "weekly", "monthly"].flatMap((window) => {
    const snapshot = newestSnapshots.get(window);
    return snapshot ? [{
      window: window as "rolling" | "weekly" | "monthly",
      remainingPercent: Number(snapshot.remaining_percent),
      usedPercent: Number(snapshot.used_percent),
      resetsAt: snapshot.resets_at,
      capturedAt: snapshot.captured_at,
    }] : [];
  });

  return {
    configured: true,
    lastAttemptAt: monitor.last_attempt_at,
    lastSuccessAt: monitor.last_success_at,
    lastError: monitor.last_error_code,
    windows,
  };
}

export async function getSupabaseGeminiUsageMonitor(): Promise<GeminiUsageMonitor> {
  const { monitor, snapshots } = await getSupabaseUsageMonitor("gemini_cli");
  return mapSupabaseGeminiUsageMonitor(monitor, snapshots);
}

export async function getSupabaseOpenCodeGoUsageMonitor(): Promise<OpenCodeGoUsageMonitor> {
  const { monitor, snapshots } = await getSupabaseUsageMonitor("opencode_go");
  return mapSupabaseOpenCodeGoUsageMonitor(monitor, snapshots);
}

async function getSupabaseUsageMonitor(provider: "gemini_cli" | "opencode_go") {
  const supabase = getSupabaseUsageMonitorClient();
  const monitorResult = await supabase
    .from("usage_monitors")
    .select("id,last_attempt_at,last_success_at,last_error_code")
    .eq("provider", provider)
    .maybeSingle();

  if (monitorResult.error) throw monitorResult.error;
  if (!monitorResult.data) return { monitor: null, snapshots: [] };

  const snapshotsResult = await supabase
    .from("usage_snapshots")
    .select("window_key,label,remaining_percent,used_percent,resets_at,captured_at")
    .eq("monitor_id", monitorResult.data.id)
    .order("captured_at", { ascending: false })
    .limit(64);

  if (snapshotsResult.error) throw snapshotsResult.error;
  return { monitor: monitorResult.data, snapshots: snapshotsResult.data ?? [] };
}
