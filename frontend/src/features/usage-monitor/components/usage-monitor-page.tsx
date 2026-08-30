/* Hallmark · macrostructure: landscape kiosk carousel · theme: existing-system-dark
 * pre-emit critique: P5 H5 E5 S5 R5 V4 · contrast: pass (40–41)
 * target: 740x360 CSS px · solid canvas · no invented metrics or redrawn device chrome
 */

import { useQuery } from "@tanstack/react-query";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listAccounts } from "@/features/accounts/api";
import type { AccountSummary } from "@/features/accounts/schemas";
import { getOpenCodeGoUsageMonitor } from "@/features/opencode-go-usage/api";
import { getGeminiUsageMonitor } from "@/features/gemini-usage/api";
import { getAntigravityUsageMonitor } from "@/features/antigravity-usage/api";
import { useThemeStore } from "@/hooks/use-theme";

import {
  accountSelection,
  ANTIGRAVITY_SELECTION,
  GEMINI_SELECTION,
  OPENCODE_GO_SELECTION,
  readUsageMonitorSelection,
  selectedAccountId,
  USAGE_MONITOR_SELECTION_STORAGE_KEY,
  type UsageMonitorSelection,
} from "../schemas";
import { useSwipe } from "../hooks/use-swipe";
import { useWakeLock } from "../hooks/use-wake-lock";
import { AccountUsageDashboard } from "./account-usage-dashboard";
import { CarouselDots } from "./carousel-dots";
import { LandscapeGate } from "./landscape-gate";
import { LiveClock } from "./live-clock";
import { OpenCodeUsageDashboard } from "./opencode-usage-dashboard";
import { GeminiUsageDashboard } from "./gemini-usage-dashboard";
import { AntigravityUsageDashboard } from "./antigravity-usage-dashboard";

const POLL_INTERVAL_MS = 60_000;
const EMPTY_ACCOUNTS: AccountSummary[] = [];

function accountLabel(account: AccountSummary): string {
  return account.displayName.trim() || account.alias?.trim() || account.email;
}

function wrappedIndex(index: number, total: number): number {
  return total === 0 ? 0 : (index % total + total) % total;
}

export function UsageMonitorPage() {
  const { t } = useTranslation();
  const [initialSelection] = useState<UsageMonitorSelection | null>(() => readUsageMonitorSelection());
  const activeSelectionRef = useRef<UsageMonitorSelection | null>(initialSelection);
  const transitionFrame = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideOffset, setSlideOffset] = useState(0);
  const accountsQuery = useQuery({
    queryKey: ["accounts", "list", "usage-monitor"],
    queryFn: listAccounts,
    select: (response) => response.accounts,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
  const monitorQuery = useQuery({
    queryKey: ["opencode-go-usage", "monitor", "usage-monitor"],
    queryFn: getOpenCodeGoUsageMonitor,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
  const geminiQuery = useQuery({ queryKey: ["gemini-usage", "monitor", "usage-monitor"], queryFn: getGeminiUsageMonitor, refetchInterval: POLL_INTERVAL_MS, refetchIntervalInBackground: true });
  const antigravityQuery = useQuery({ queryKey: ["antigravity-usage", "monitor", "usage-monitor"], queryFn: getAntigravityUsageMonitor, refetchInterval: POLL_INTERVAL_MS, refetchIntervalInBackground: true });
  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS;
  const includeOpenCode = monitorQuery.data?.configured === true;
  const selections = useMemo<UsageMonitorSelection[]>(() => [
    ...accounts.map((account) => accountSelection(account.accountId)),
    ...(includeOpenCode ? [OPENCODE_GO_SELECTION] : []),
    ...(geminiQuery.data?.configured ? [GEMINI_SELECTION] : []),
    ...(antigravityQuery.data?.configured ? [ANTIGRAVITY_SELECTION] : []),
  ], [accounts, antigravityQuery.data?.configured, geminiQuery.data?.configured, includeOpenCode]);

  useWakeLock();

  useEffect(() => {
    const previousPreference = useThemeStore.getState().preference;
    useThemeStore.getState().setTheme("dark");
    document.documentElement.classList.add("overflow-x-clip", "overflow-hidden");
    document.body.classList.add("overflow-x-clip", "overflow-hidden");
    return () => {
      useThemeStore.getState().setTheme(previousPreference);
      document.documentElement.classList.remove("overflow-x-clip", "overflow-hidden");
      document.body.classList.remove("overflow-x-clip", "overflow-hidden");
    };
  }, []);

  useEffect(() => {
    const orientation = window.screen.orientation;
    if (!orientation?.lock) return;
    void orientation.lock("landscape").catch(() => undefined);
    return () => orientation.unlock?.();
  }, []);

  useEffect(() => {
    if (selections.length === 0) {
      startTransition(() => {
        setActiveIndex(0);
      });
      return;
    }

    const rememberedIndex = selections.indexOf(activeSelectionRef.current ?? initialSelection ?? "");
    const nextIndex = rememberedIndex >= 0 ? rememberedIndex : 0;
    startTransition(() => {
      setActiveIndex(nextIndex);
    });
    activeSelectionRef.current = selections[nextIndex] ?? null;
  }, [initialSelection, selections]);

  const selection = selections[activeIndex] ?? null;
  const accountId = selectedAccountId(selection);
  const selectedAccount = accounts.find((account) => account.accountId === accountId) ?? null;
  const isFetching = accountsQuery.isFetching || monitorQuery.isFetching || geminiQuery.isFetching || antigravityQuery.isFetching;

  useEffect(() => {
    if (!selection) return;
    activeSelectionRef.current = selection;
    window.localStorage.setItem(USAGE_MONITOR_SELECTION_STORAGE_KEY, selection);
  }, [selection]);

  useEffect(() => () => {
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
  }, []);

  const selectIndex = useCallback((nextIndex: number, direction: 1 | -1) => {
    if (selections.length === 0) return;
    setSlideOffset(direction * 24);
    setActiveIndex(wrappedIndex(nextIndex, selections.length));
    if (transitionFrame.current !== null) window.cancelAnimationFrame(transitionFrame.current);
    transitionFrame.current = window.requestAnimationFrame(() => {
      transitionFrame.current = window.requestAnimationFrame(() => setSlideOffset(0));
    });
  }, [selections.length]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => selectIndex(activeIndex + 1, 1),
    onSwipeRight: () => selectIndex(activeIndex - 1, -1),
  });

  return (
    <div data-testid="usage-monitor-canvas" className="h-dvh min-h-screen overflow-hidden bg-[#09090b] text-foreground">
      <div className="grid h-full min-h-0 grid-rows-[32px_minmax(0,1fr)_20px] p-2">
        <header className="flex h-8 min-w-0 items-center gap-2">
          <Select value={selection ?? ""} onValueChange={(value) => {
            const nextIndex = selections.indexOf(value as UsageMonitorSelection);
            if (nextIndex >= 0) selectIndex(nextIndex, nextIndex >= activeIndex ? 1 : -1);
          }}>
            <SelectTrigger aria-label={t("usageMonitor.selectAccount")} className="h-8 min-w-0 flex-1 truncate rounded-none border-0 bg-transparent px-0 text-sm font-semibold tracking-tight text-zinc-100 shadow-none focus-visible:ring-1 sm:text-base">
              <SelectValue className="min-w-0 truncate" placeholder={t("usageMonitor.noSource")} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.accountId} value={accountSelection(account.accountId)}>{accountLabel(account)}</SelectItem>
              ))}
              {includeOpenCode ? <SelectItem value={OPENCODE_GO_SELECTION}>OpenCode Go</SelectItem> : null}
              {geminiQuery.data?.configured ? <SelectItem value={GEMINI_SELECTION}>{t("usageMonitor.googleAiPro")}</SelectItem> : null}
              {antigravityQuery.data?.configured ? <SelectItem value={ANTIGRAVITY_SELECTION}>{t("usageMonitor.antigravity")}</SelectItem> : null}
            </SelectContent>
          </Select>
          <LiveClock isFetching={isFetching} />
        </header>

        <main className="min-h-0 overflow-hidden">
          <LandscapeGate>
            <div
              {...swipeHandlers}
              data-testid="usage-monitor-dashboard"
              data-active-selection={selection ?? ""}
              className="h-full touch-pan-y"
              style={{ transform: `translateX(${slideOffset}px)`, transition: "transform 300ms ease-out" }}
            >
              {accountsQuery.error || monitorQuery.error || geminiQuery.error || antigravityQuery.error ? (
                <p role="alert" className="flex h-full items-center justify-center p-2 text-center text-xs text-destructive">{t("usageMonitor.loadFailed")}</p>
              ) : selection === OPENCODE_GO_SELECTION && monitorQuery.data?.configured ? (
                <OpenCodeUsageDashboard monitor={monitorQuery.data} />
              ) : selection === GEMINI_SELECTION && geminiQuery.data?.configured ? (
                <GeminiUsageDashboard monitor={geminiQuery.data} />
              ) : selection === ANTIGRAVITY_SELECTION && antigravityQuery.data?.configured ? (
                <AntigravityUsageDashboard monitor={antigravityQuery.data} />
              ) : selectedAccount ? (
                <AccountUsageDashboard account={selectedAccount} />
              ) : (
                <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  {accountsQuery.isPending || monitorQuery.isPending || geminiQuery.isPending || antigravityQuery.isPending ? t("usageMonitor.loading") : t("usageMonitor.noSource")}
                </div>
              )}
            </div>
          </LandscapeGate>
        </main>

        <CarouselDots total={selections.length} active={activeIndex} />
      </div>
    </div>
  );
}
