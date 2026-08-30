import { useEffect, useState } from "react";

import { DonutChart } from "@/components/donut-chart";

type UsageDonutCardProps = {
  title: string;
  remaining: number;
  total: number;
  resetAt: string | null | undefined;
  resetLabel: string;
  usedLabel: string;
  remainingLabel: string;
  usedPercent?: number;
};

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function usageColor(usedPercent: number): string {
  if (usedPercent <= 50) return "#22c55e";
  if (usedPercent <= 75) return "#eab308";
  if (usedPercent <= 90) return "#f97316";
  return "#ef4444";
}

function formatCountdown(resetAt: string | null | undefined, now: number): string | null {
  if (!resetAt) return null;
  const remainingMilliseconds = new Date(resetAt).getTime() - now;
  if (!Number.isFinite(remainingMilliseconds)) return null;
  if (remainingMilliseconds <= 0) return "00:00:00";

  const totalSeconds = Math.floor(remainingMilliseconds / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function UsageDonutCard({
  title,
  remaining,
  total,
  resetAt,
  resetLabel,
  usedLabel,
  remainingLabel,
  usedPercent,
}: UsageDonutCardProps) {
  const [now, setNow] = useState(Date.now);
  const remainingPercent = total > 0 ? clampPercent((remaining / total) * 100) : 0;
  const calculatedUsedPercent = 100 - remainingPercent;
  const displayUsedPercent = clampPercent(usedPercent ?? calculatedUsedPercent);
  const donutColor = usageColor(displayUsedPercent);
  const countdown = formatCountdown(resetAt, now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="flex h-full min-w-0 flex-col rounded-lg border border-white/10 bg-card p-2" aria-label={title}>
      <div className="text-center">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">{displayUsedPercent.toFixed(0)}%</p>
          <p className="text-[11px] text-muted-foreground">{usedLabel}</p>
          <p className="text-[11px] text-muted-foreground">{remainingPercent.toFixed(0)}% {remainingLabel}</p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-1">
        <DonutChart
          title={title}
          items={[{ id: "used", label: usedLabel, value: displayUsedPercent, color: donutColor }]}
          total={100}
          compact
        />
      </div>
      <p className="text-center text-[11px] tabular-nums text-muted-foreground">
        {countdown ? `${resetLabel} ${countdown}` : resetLabel}
      </p>
    </section>
  );
}
