import { useTranslation } from "react-i18next";
import type { GeminiUsageMonitor } from "@/features/gemini-usage/schemas";
import { UsageDonutCard } from "./usage-donut-card";

export function GeminiUsageDashboard({ monitor }: { monitor: GeminiUsageMonitor }) {
  const { t } = useTranslation();
  const primary = [
    "pro_latest",
    monitor.windows.some((candidate) => candidate.window === "flash_latest")
      ? "flash_latest"
      : "flash_lite_latest",
  ];
  return <div className="grid h-full min-w-0 grid-cols-2 gap-3">
    {primary.map((key) => {
      const item = monitor.windows.find((candidate) => candidate.window === key);
      return item ? <UsageDonutCard key={key} title={item.label} remaining={item.remainingPercent} total={100} resetAt={item.resetsAt} resetLabel={t("usageMonitor.resetsIn")} usedLabel={t("usageMonitor.used")} remainingLabel={t("usageMonitor.remaining")} usedPercent={item.usedPercent} /> : <Unavailable key={key} label={key === "pro_latest" ? t("usageMonitor.geminiPro") : t("usageMonitor.geminiFlash")} />;
    })}
  </div>;
}

function Unavailable({ label }: { label: string }) { const { t } = useTranslation(); return <section className="flex h-full min-w-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-card p-2 text-center"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xs text-muted-foreground">{t("usageMonitor.notAvailable")}</p></section>; }
