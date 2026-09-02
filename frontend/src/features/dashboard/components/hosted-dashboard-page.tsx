import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { getHostedDashboardReadModel, subscribeHostedDashboardReadModel } from "../hosted-dashboard-read-model";

const REFRESH_INTERVAL_MS = 60_000;

function formatTimestamp(value: string | null): string {
  if (!value) return "Sem leitura";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function resetText(resetAt: number | null): string {
  if (!resetAt) return "sem horário de renovação";
  return `renova ${formatTimestamp(new Date(resetAt * 1000).toISOString())}`;
}

export function HostedDashboardPage() {
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: ["hosted-dashboard-read-model"],
    queryFn: getHostedDashboardReadModel,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  useEffect(() => subscribeHostedDashboardReadModel(() => {
    void queryClient.invalidateQueries({ queryKey: ["hosted-dashboard-read-model"] });
  }), [queryClient]);

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Vercel + Supabase</p>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard hospedado</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Leitura atualizada automaticamente. Operações de routing seguem no runtime legado.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/usage-monitor">Abrir monitor de uso</Link>
          </Button>
        </header>

        {dashboard.isPending ? <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Carregando contas e quotas…</div> : null}
        {dashboard.error ? <div role="alert" className="rounded-xl border border-destructive/50 bg-card p-6 text-sm text-destructive">Não foi possível carregar o Dashboard hospedado.</div> : null}
        {dashboard.data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Contas</p><p className="mt-1 text-2xl font-semibold">{dashboard.data.accounts.length}</p></div>
              <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Última quota</p><p className="mt-1 text-sm font-medium">{formatTimestamp(dashboard.data.lastSyncAt)}</p></div>
              <div className="rounded-xl border bg-card p-4"><p className="text-sm text-muted-foreground">Modo</p><p className="mt-1 text-sm font-medium">Somente leitura</p></div>
            </section>
            <section aria-label="Contas hospedadas" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.data.accounts.map((account) => (
                <article key={account.accountId} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><h2 className="truncate text-base font-semibold">{account.displayName}</h2><p className="truncate text-sm text-muted-foreground">{account.email}</p></div>
                    <span className="rounded-full border px-2 py-0.5 text-xs capitalize">{account.status}</span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">{account.planType}</p>
                  <div className="mt-3 space-y-2">
                    {account.windows.length ? account.windows.map((window) => (
                      <div key={window.key} className="rounded-lg bg-muted/60 p-2">
                        <div className="flex justify-between gap-2 text-sm"><span className="capitalize">{window.key}</span><span className="font-medium">{Math.round(window.remainingPercent)}% disponível</span></div>
                        <p className="mt-1 text-xs text-muted-foreground">{resetText(window.resetAt)}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Sem quota importada.</p>}
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
