import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  clearOpenCodeGoUsage,
  configureOpenCodeGoUsage,
  getOpenCodeGoUsageMonitor,
  refreshOpenCodeGoUsage,
} from "@/features/opencode-go-usage/api";

const queryKey = ["opencode-go-usage", "monitor"] as const;

export function useOpenCodeGoUsage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const monitorQuery = useQuery({
    queryKey,
    queryFn: getOpenCodeGoUsageMonitor,
    refetchInterval: 120_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const configureMutation = useMutation({
    mutationFn: configureOpenCodeGoUsage,
    onSuccess: () => {
      toast.success(t("opencodeGoUsage.toasts.saved"));
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message || t("opencodeGoUsage.toasts.saveFailed")),
  });
  const refreshMutation = useMutation({
    mutationFn: refreshOpenCodeGoUsage,
    onSuccess: () => {
      toast.success(t("opencodeGoUsage.toasts.refreshed"));
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message || t("opencodeGoUsage.toasts.refreshFailed")),
  });
  const clearMutation = useMutation({
    mutationFn: clearOpenCodeGoUsage,
    onSuccess: () => {
      toast.success(t("opencodeGoUsage.toasts.removed"));
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message || t("opencodeGoUsage.toasts.removeFailed")),
  });

  return { monitorQuery, configureMutation, refreshMutation, clearMutation };
}
