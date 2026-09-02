import { getSupabaseUsageMonitorClient } from "@/features/gemini-usage/supabase-usage-monitor";

type HostedDashboardAccountRow = {
  legacy_account_id: string;
  email: string;
  alias: string | null;
  plan_type: string;
  status: string;
  last_refresh_at: string | null;
};

type HostedDashboardUsageRow = {
  legacy_account_id: string;
  window_key: string | null;
  used_percent: number | string;
  reset_at: number | null;
  recorded_at: string;
};

export type HostedDashboardWindow = {
  key: string;
  usedPercent: number;
  remainingPercent: number;
  resetAt: number | null;
};

export type HostedDashboardAccount = {
  accountId: string;
  displayName: string;
  email: string;
  planType: string;
  status: string;
  lastRefreshAt: string | null;
  windows: HostedDashboardWindow[];
};

export type HostedDashboardReadModel = {
  lastSyncAt: string | null;
  accounts: HostedDashboardAccount[];
};

export function mapHostedDashboardReadModel(
  accounts: HostedDashboardAccountRow[],
  usageHistory: HostedDashboardUsageRow[],
): HostedDashboardReadModel {
  const newestByAccountWindow = new Map<string, HostedDashboardUsageRow>();
  for (const sample of usageHistory) {
    if (!sample.window_key) continue;
    const key = `${sample.legacy_account_id}:${sample.window_key}`;
    const current = newestByAccountWindow.get(key);
    if (!current || current.recorded_at < sample.recorded_at) {
      newestByAccountWindow.set(key, sample);
    }
  }

  const windowsByAccount = new Map<string, HostedDashboardWindow[]>();
  for (const sample of newestByAccountWindow.values()) {
    const windows = windowsByAccount.get(sample.legacy_account_id) ?? [];
    windows.push({
      key: sample.window_key!,
      usedPercent: Number(sample.used_percent),
      remainingPercent: 100 - Number(sample.used_percent),
      resetAt: sample.reset_at,
    });
    windowsByAccount.set(sample.legacy_account_id, windows);
  }

  const latest = usageHistory.reduce<string | null>(
    (current, sample) => !current || current < sample.recorded_at ? sample.recorded_at : current,
    null,
  );
  return {
    lastSyncAt: latest,
    accounts: accounts.map((account) => ({
      accountId: account.legacy_account_id,
      displayName: account.alias?.trim() || account.email,
      email: account.email,
      planType: account.plan_type,
      status: account.status,
      lastRefreshAt: account.last_refresh_at,
      windows: windowsByAccount.get(account.legacy_account_id) ?? [],
    })),
  };
}

export async function getHostedDashboardReadModel(): Promise<HostedDashboardReadModel> {
  const supabase = getSupabaseUsageMonitorClient();
  const [accountsResult, usageResult] = await Promise.all([
    supabase
      .from("hosted_dashboard_accounts")
      .select("legacy_account_id,email,alias,plan_type,status,last_refresh_at")
      .order("email"),
    supabase
      .from("hosted_dashboard_usage_history")
      .select("legacy_account_id,window_key,used_percent,reset_at,recorded_at")
      .order("recorded_at", { ascending: false })
      .limit(1000),
  ]);
  if (accountsResult.error) throw accountsResult.error;
  if (usageResult.error) throw usageResult.error;
  return mapHostedDashboardReadModel(accountsResult.data ?? [], usageResult.data ?? []);
}
