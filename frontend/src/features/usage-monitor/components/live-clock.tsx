import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

type LiveClockProps = {
  isFetching: boolean;
};

function formatClock(now: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

export function LiveClock({ isFetching }: LiveClockProps) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <time
      aria-label={t("usageMonitor.clock")}
      dateTime={now.toISOString()}
      data-fetching={isFetching ? "true" : "false"}
      className={`shrink-0 font-mono text-xs tabular-nums text-muted-foreground ${
        isFetching && !reducedMotion ? "animate-pulse" : ""
      }`}
    >
      {formatClock(now)}
    </time>
  );
}
