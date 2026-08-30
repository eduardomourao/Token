import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (!needRefresh) return;

    toast(t("pwa.update.available"), {
      description: t("pwa.update.description"),
      action: {
        label: t("pwa.update.action"),
        onClick: () => void updateServiceWorker(true),
      },
      duration: Infinity,
    });
  }, [needRefresh, t, updateServiceWorker]);

  return null;
}
