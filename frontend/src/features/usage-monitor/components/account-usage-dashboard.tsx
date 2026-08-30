import { useTranslation } from "react-i18next";

import type { AccountSummary } from "@/features/accounts/schemas";

import { UsageDonutCard } from "./usage-donut-card";

type AccountUsageDashboardProps = {
  account: AccountSummary;
};

function availability(capacity: number | null | undefined, remaining: number | null | undefined) {
  if (typeof capacity === "number" && typeof remaining === "number") {
    return { capacity, remaining };
  }
  return null;
}

function UnavailablePanel({ label, message }: { label: string; message: string }) {
  return (
    <section className="flex h-full min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-card p-2 text-center" aria-label={label}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{message}</p>
    </section>
  );
}

export function AccountUsageDashboard({ account }: AccountUsageDashboardProps) {
  const { t } = useTranslation();
  const primary = availability(account.capacityCreditsPrimary, account.remainingCreditsPrimary);
  const secondary = availability(account.capacityCreditsSecondary, account.remainingCreditsSecondary);

  return (
    <div className="grid h-full min-w-0 grid-cols-2 gap-3">
      {primary ? (
        <UsageDonutCard
          title={t("usageMonitor.dailyUsage")}
          remaining={primary.remaining}
          total={primary.capacity}
          resetAt={account.resetAtPrimary}
          resetLabel={t("usageMonitor.resetsIn")}
          usedLabel={t("usageMonitor.used")}
          remainingLabel={t("usageMonitor.remaining")}
        />
      ) : <UnavailablePanel label={t("usageMonitor.dailyUsage")} message={t("usageMonitor.notAvailable")} />}
      {secondary ? (
        <UsageDonutCard
          title={t("usageMonitor.weeklyUsage")}
          remaining={secondary.remaining}
          total={secondary.capacity}
          resetAt={account.resetAtSecondary}
          resetLabel={t("usageMonitor.resetsIn")}
          usedLabel={t("usageMonitor.used")}
          remainingLabel={t("usageMonitor.remaining")}
        />
      ) : <UnavailablePanel label={t("usageMonitor.weeklyUsage")} message={t("usageMonitor.noWeeklyLimit")} />}
    </div>
  );
}
