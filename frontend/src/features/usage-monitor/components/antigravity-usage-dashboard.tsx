import { useTranslation } from "react-i18next";
import type { AntigravityUsageMonitor } from "@/features/antigravity-usage/schemas";
import { UsageDonutCard } from "./usage-donut-card";

export function AntigravityUsageDashboard({ monitor }: { monitor: AntigravityUsageMonitor }) {
  const { t } = useTranslation();
  const groups = [["gemini", t("usageMonitor.geminiPool")], ["claude_gpt", t("usageMonitor.claudeGptPool")]] as const;
  return <div className="grid h-full min-w-0 grid-cols-2 gap-3">
    {groups.map(([group, label]) => {
      const item = monitor.windows.find((candidate) => candidate.group === group);
      return item ? <UsageDonutCard key={group} title={`${label} · ${item.windowKind === "five_hour" ? t("usageMonitor.fiveHour") : t("usageMonitor.weeklyUsage")}`} remaining={item.remainingPercent} total={100} resetAt={item.resetsAt} resetLabel={t("usageMonitor.resetsIn")} usedLabel={t("usageMonitor.used")} remainingLabel={t("usageMonitor.remaining")} usedPercent={item.usedPercent} /> : <Unavailable key={group} label={label} />;
    })}
  </div>;
}

function Unavailable({ label }: { label: string }) { const { t } = useTranslation(); return <section className="flex h-full min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-card p-2 text-center"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xs text-muted-foreground">{t("usageMonitor.notAvailable")}</p></section>; }
