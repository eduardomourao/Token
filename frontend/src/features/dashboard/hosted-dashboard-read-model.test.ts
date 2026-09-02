import { describe, expect, it } from "vitest";

import { mapHostedDashboardReadModel } from "./hosted-dashboard-read-model";

describe("mapHostedDashboardReadModel", () => {
  it("keeps the latest sample per account and window while excluding unavailable history", () => {
    const result = mapHostedDashboardReadModel(
      [{ legacy_account_id: "account-a", email: "operator@example.com", alias: "Primary", plan_type: "pro", status: "active", last_refresh_at: "2026-09-01T09:00:00Z" }],
      [
        { legacy_account_id: "account-a", window_key: "primary", used_percent: 55, reset_at: 1_788_300_000, recorded_at: "2026-09-01T10:00:00Z" },
        { legacy_account_id: "account-a", window_key: "primary", used_percent: 35, reset_at: 1_788_301_000, recorded_at: "2026-09-01T11:00:00Z" },
        { legacy_account_id: "account-a", window_key: "monthly", used_percent: 20, reset_at: null, recorded_at: "2026-09-01T10:30:00Z" },
      ],
    );

    expect(result.lastSyncAt).toBe("2026-09-01T11:00:00Z");
    expect(result.accounts).toEqual([{
      accountId: "account-a",
      displayName: "Primary",
      email: "operator@example.com",
      planType: "pro",
      status: "active",
      lastRefreshAt: "2026-09-01T09:00:00Z",
      windows: [
        { key: "primary", usedPercent: 35, remainingPercent: 65, resetAt: 1_788_301_000 },
        { key: "monthly", usedPercent: 20, remainingPercent: 80, resetAt: null },
      ],
    }]);
  });
});
