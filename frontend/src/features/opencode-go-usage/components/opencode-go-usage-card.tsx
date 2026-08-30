import { Activity, RefreshCw, Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AlertMessage } from "@/components/alert-message";
import { Button } from "@/components/ui/button";
import { useOpenCodeGoUsage } from "@/features/opencode-go-usage/hooks/use-opencode-go-usage";

type OpenCodeGoUsageCardProps = {
  canWrite: boolean;
  onConfigure: () => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function OpenCodeGoUsageCard({ canWrite, onConfigure }: OpenCodeGoUsageCardProps) {
  const { t } = useTranslation();
  const { monitorQuery, refreshMutation } = useOpenCodeGoUsage();
  const monitor = monitorQuery.data;

  return (
    <section className="space-y-4 rounded-xl border bg-card p-5" aria-label={t("opencodeGoUsage.title")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t("opencodeGoUsage.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("opencodeGoUsage.dashboardDescription")}</p>
          </div>
        </div>
        {monitor?.configured && canWrite ? (
          <Button type="button" variant="outline" size="sm" disabled={refreshMutation.isPending} onClick={() => refreshMutation.mutate()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            {t("opencodeGoUsage.actions.refresh")}
          </Button>
        ) : null}
      </div>

      {monitorQuery.error ? <AlertMessage variant="error">{monitorQuery.error.message}</AlertMessage> : null}
      {monitorQuery.isPending ? (
        <div role="status" className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          {t("opencodeGoUsage.loading")}
        </div>
      ) : !monitor?.configured ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4">
          <p className="text-sm text-muted-foreground">{t("opencodeGoUsage.empty")}</p>
          {canWrite ? (
            <Button type="button" size="sm" onClick={onConfigure}>
              <Settings2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
              {t("opencodeGoUsage.actions.configure")}
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          {monitor.lastError ? <AlertMessage variant="error">{t("opencodeGoUsage.stale")}</AlertMessage> : null}
          <div className="grid gap-2 sm:grid-cols-3">
            {(["rolling", "weekly", "monthly"] as const).map((windowName) => {
              const window = monitor.windows.find((candidate) => candidate.window === windowName);
              return (
                <div key={windowName} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{t(`opencodeGoUsage.windows.${windowName}`)}</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {window ? `${window.remainingPercent.toFixed(1)}%` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {window ? t("opencodeGoUsage.resetAt", { date: formatDate(window.resetsAt) }) : t("opencodeGoUsage.noData")}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t("opencodeGoUsage.lastUpdated", { date: formatDate(monitor.lastSuccessAt) })}
          </p>
        </>
      )}
    </section>
  );
}
