import { useTranslation } from "react-i18next";

import type { OpenCodeGoUsageMonitor } from "@/features/opencode-go-usage/schemas";

import { UsageDonutCard } from "./usage-donut-card";

type OpenCodeUsageDashboardProps = {
  monitor: OpenCodeGoUsageMonitor;
};

function UnavailablePanel({ label, message }: { label: string; message: string }) {
  return (
    <section className="flex h-full min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-card p-2 text-center" aria-label={label}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{message}</p>
    </section>
  );
}

export function OpenCodeUsageDashboard({ monitor }: OpenCodeUsageDashboardProps) {
  const { t } = useTranslation();

  return (
    <div className="grid h-full min-w-0 grid-cols-2 gap-3">
      {(["rolling", "weekly"] as const).map((windowName) => {
        const window = monitor.windows.find((candidate) => candidate.window === windowName);
        const title = windowName === "rolling" ? t("usageMonitor.dailyUsage") : t("usageMonitor.weeklyUsage");
        return window ? (
          <UsageDonutCard
          key={window.window}
          title={title}
          remaining={window.remainingPercent}
          total={100}
          resetAt={window.resetsAt}
          resetLabel={t("usageMonitor.resetsIn")}
          usedLabel={t("usageMonitor.used")}
          remainingLabel={t("usageMonitor.remaining")}
          usedPercent={window.usedPercent}
          />
        ) : <UnavailablePanel key={windowName} label={title} message={t("usageMonitor.notAvailable")} />;
      })}
    </div>
  );
}
