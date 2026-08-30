import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

const DISMISSAL_STORAGE_KEY = "codex-lb-pwa-install-dismissed";

function readDismissal(): boolean {
  try {
    return window.localStorage.getItem(DISMISSAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissal(): void {
  try {
    window.localStorage.setItem(DISMISSAL_STORAGE_KEY, "true");
  } catch {
    // Storage is optional; the banner will still be dismissed for this session.
  }
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaInstallBanner() {
  const { t } = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(readDismissal);

  useEffect(() => {
    if (dismissed || isStandalone()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [dismissed]);

  const dismiss = () => {
    writeDismissal();
    setDeferredPrompt(null);
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismiss();
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <aside className="mt-3 flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 p-3 text-sm shadow-lg shadow-black/10" aria-label={t("pwa.install.title")}>
      <Download className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">{t("pwa.install.title")}</p>
        <p className="text-xs text-muted-foreground">{t("pwa.install.description")}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => void install()}>{t("pwa.install.action")}</Button>
      <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label={t("pwa.install.dismiss")}>
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </aside>
  );
}
