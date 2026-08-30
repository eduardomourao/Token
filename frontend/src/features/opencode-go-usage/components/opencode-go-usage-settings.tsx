import { Download, KeyRound, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AlertMessage } from "@/components/alert-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadOpenCodeGoUsageCsv } from "@/features/opencode-go-usage/api";
import { useOpenCodeGoUsage } from "@/features/opencode-go-usage/hooks/use-opencode-go-usage";

export type OpenCodeGoUsageSettingsProps = { disabled: boolean };

export function OpenCodeGoUsageSettings({ disabled }: OpenCodeGoUsageSettingsProps) {
  const { t } = useTranslation();
  const [apiKey, setApiKey] = useState("");
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const { monitorQuery, configureMutation, refreshMutation, clearMutation } = useOpenCodeGoUsage();
  const monitor = monitorQuery.data;
  const busy = disabled || configureMutation.isPending || refreshMutation.isPending || clearMutation.isPending;
  const error = monitorQuery.error || configureMutation.error || refreshMutation.error || clearMutation.error;

  const save = async () => {
    await configureMutation.mutateAsync(apiKey);
    setApiKey("");
  };
  const download = async () => {
    setDownloadError(null);
    try {
      const blob = await downloadOpenCodeGoUsageCsv();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = "opencode-go-usage.csv";
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (downloadFailure) {
      setDownloadError(downloadFailure instanceof Error ? downloadFailure.message : t("opencodeGoUsage.toasts.downloadFailed"));
    }
  };

  return (
    <section id="opencode-go-usage" className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">{t("opencodeGoUsage.settingsTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("opencodeGoUsage.settingsDescription")}</p>
        </div>
      </div>

      {error ? <AlertMessage variant="error">{error.message}</AlertMessage> : null}
      {downloadError ? <AlertMessage variant="error">{downloadError}</AlertMessage> : null}
      {monitorQuery.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">{t("opencodeGoUsage.loading")}</p>
      ) : (
        <div className="space-y-2">
          <label htmlFor="opencode-go-api-key" className="text-sm font-medium">{t("opencodeGoUsage.keyLabel")}</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="opencode-go-api-key"
              type="password"
              autoComplete="off"
              value={apiKey}
              disabled={busy}
              placeholder={monitor?.configured ? t("opencodeGoUsage.keyConfigured") : t("opencodeGoUsage.keyPlaceholder")}
              onChange={(event) => setApiKey(event.target.value)}
            />
            <Button type="button" disabled={busy || !apiKey.trim()} onClick={() => void save()}>
              {monitor?.configured ? t("opencodeGoUsage.actions.replace") : t("opencodeGoUsage.actions.save")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("opencodeGoUsage.keyHint")}</p>
        </div>
      )}

      {monitor?.configured ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => refreshMutation.mutate()}>
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            {t("opencodeGoUsage.actions.refresh")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void download()}>
            <Download className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            {t("opencodeGoUsage.actions.download")}
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => setConfirmingRemoval(true)}>
            <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            {t("opencodeGoUsage.actions.remove")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmingRemoval}
        title={t("opencodeGoUsage.removeDialog.title")}
        description={t("opencodeGoUsage.removeDialog.description")}
        confirmLabel={t("opencodeGoUsage.actions.remove")}
        confirmDisabled={busy}
        onOpenChange={setConfirmingRemoval}
        onConfirm={() => {
          void clearMutation.mutateAsync().finally(() => setConfirmingRemoval(false));
        }}
      />
    </section>
  );
}
