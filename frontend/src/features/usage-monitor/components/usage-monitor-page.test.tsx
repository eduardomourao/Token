import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listAccounts } from "@/features/accounts/api";
import { getOpenCodeGoUsageMonitor } from "@/features/opencode-go-usage/api";
import { getGeminiUsageMonitor } from "@/features/gemini-usage/api";
import { getAntigravityUsageMonitor } from "@/features/antigravity-usage/api";
import { createAccountSummary } from "@/test/mocks/factories";
import { renderWithProviders } from "@/test/utils";

import { UsageMonitorPage } from "./usage-monitor-page";

vi.mock("@/features/accounts/api", () => ({ listAccounts: vi.fn() }));
vi.mock("@/features/opencode-go-usage/api", () => ({ getOpenCodeGoUsageMonitor: vi.fn() }));
vi.mock("@/features/gemini-usage/api", () => ({ getGeminiUsageMonitor: vi.fn() }));
vi.mock("@/features/antigravity-usage/api", () => ({ getAntigravityUsageMonitor: vi.fn() }));
vi.mock("@/components/donut-chart", () => ({
  DonutChart: ({ title }: { title: string }) => <div data-testid="donut-chart">{title}</div>,
}));

const listAccountsMock = vi.mocked(listAccounts);
const getOpenCodeGoUsageMonitorMock = vi.mocked(getOpenCodeGoUsageMonitor);
const getGeminiUsageMonitorMock = vi.mocked(getGeminiUsageMonitor);
const getAntigravityUsageMonitorMock = vi.mocked(getAntigravityUsageMonitor);
const originalOrientation = Object.getOwnPropertyDescriptor(window.screen, "orientation");

const account = createAccountSummary({
  displayName: "Phone account",
  alias: "Phone alias",
  capacityCreditsMonthly: 1000,
  remainingCreditsMonthly: 700,
  resetAtMonthly: "2026-09-01T00:00:00Z",
  requestUsage: {
    requestCount: 42,
    totalTokens: 12_000,
    cachedInputTokens: 1_200,
    totalCostUsd: 1.5,
  },
});

const secondAccount = createAccountSummary({
  accountId: "acc_secondary",
  displayName: "Second phone account",
  alias: "Second phone alias",
});

function configuredMonitor(configured = true) {
  return {
    configured,
    lastAttemptAt: "2026-08-29T12:00:00Z",
    lastSuccessAt: "2026-08-29T12:00:00Z",
    lastError: null,
    windows: configured
      ? [
          { window: "rolling" as const, remainingPercent: 80, usedPercent: 20, resetsAt: "2026-08-29T14:00:00Z", capturedAt: "2026-08-29T12:00:00Z" },
          { window: "weekly" as const, remainingPercent: 60, usedPercent: 40, resetsAt: "2026-09-01T12:00:00Z", capturedAt: "2026-08-29T12:00:00Z" },
          { window: "monthly" as const, remainingPercent: 40, usedPercent: 60, resetsAt: "2026-10-01T12:00:00Z", capturedAt: "2026-08-29T12:00:00Z" },
        ]
      : [],
  };
}

describe("UsageMonitorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    listAccountsMock.mockResolvedValue({ accounts: [account] });
    getOpenCodeGoUsageMonitorMock.mockResolvedValue(configuredMonitor());
    getGeminiUsageMonitorMock.mockResolvedValue({ configured: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null, windows: [] });
    getAntigravityUsageMonitorMock.mockResolvedValue({ configured: false, lastAttemptAt: null, lastSuccessAt: null, lastError: null, windows: [] });
  });

  afterEach(() => {
    if (originalOrientation) Object.defineProperty(window.screen, "orientation", originalOrientation);
    else Reflect.deleteProperty(window.screen, "orientation");
  });

  it("requests landscape while mounted and releases it when leaving the kiosk", async () => {
    const lock = vi.fn().mockResolvedValue(undefined);
    const unlock = vi.fn();
    Object.defineProperty(window.screen, "orientation", { configurable: true, value: { lock, unlock } });
    const { unmount } = renderWithProviders(<UsageMonitorPage />);

    await waitFor(() => expect(lock).toHaveBeenCalledWith("landscape"));
    unmount();
    expect(unlock).toHaveBeenCalledOnce();
  });

  it("renders a standalone two-panel selected-account dashboard and persists the selection", async () => {
    renderWithProviders(<UsageMonitorPage />);

    expect(await screen.findByTestId("usage-monitor-canvas")).toHaveClass("min-h-screen");
    expect(await screen.findByText("Phone account")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Select account" })).toHaveTextContent("Phone account");
    expect((await screen.findAllByText("Daily usage")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Weekly usage").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("donut-chart")).toHaveLength(2);
    expect(screen.queryByText("Request stats")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("codex-lb-usage-monitor-selection")).toBe("account:acc_primary");
  });

  it("appends configured OpenCode Go and renders its independent window dashboard", async () => {
    const user = userEvent.setup();
    renderWithProviders(<UsageMonitorPage />);

    await screen.findByRole("combobox", { name: "Select account" });
    await user.click(screen.getByRole("combobox", { name: "Select account" }));
    await user.click(await screen.findByRole("option", { name: "OpenCode Go" }));

    expect((await screen.findAllByText("Daily usage")).length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("donut-chart")).toHaveLength(2);
    expect(screen.queryByText("Last synced")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("codex-lb-usage-monitor-selection")).toBe("opencode-go");
  });

  it("cycles the ordered selections with a horizontal swipe and persists the new source", async () => {
    listAccountsMock.mockResolvedValue({ accounts: [account, secondAccount] });
    renderWithProviders(<UsageMonitorPage />);

    const dashboard = await screen.findByTestId("usage-monitor-dashboard");
    await waitFor(() => expect(dashboard).toHaveAttribute("data-active-selection", "account:acc_primary"));
    fireEvent.touchStart(dashboard, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(dashboard, { changedTouches: [{ clientX: 200, clientY: 103 }] });

    await waitFor(() => expect(screen.getByTestId("usage-monitor-dashboard")).toHaveAttribute("data-active-selection", "account:acc_secondary"));
    expect(window.localStorage.getItem("codex-lb-usage-monitor-selection")).toBe("account:acc_secondary");
  });

  it("does not offer OpenCode Go when its monitor is not configured", async () => {
    getOpenCodeGoUsageMonitorMock.mockResolvedValue(configuredMonitor(false));
    const user = userEvent.setup();
    renderWithProviders(<UsageMonitorPage />);

    await screen.findByRole("combobox", { name: "Select account" });
    await user.click(screen.getByRole("combobox", { name: "Select account" }));

    expect(screen.queryByRole("option", { name: "OpenCode Go" })).not.toBeInTheDocument();
  });

  it("adds configured Google AI Pro and Antigravity monitors to the carousel", async () => {
    getGeminiUsageMonitorMock.mockResolvedValue({
      configured: true, lastAttemptAt: null, lastSuccessAt: null, lastError: null,
      windows: [{ window: "pro_latest", label: "Pro Latest", remainingPercent: 70, usedPercent: 30, resetsAt: "2026-09-01T00:00:00Z", capturedAt: "2026-08-29T00:00:00Z" }],
    });
    getAntigravityUsageMonitorMock.mockResolvedValue({
      configured: true, lastAttemptAt: null, lastSuccessAt: null, lastError: null,
      windows: [{ group: "gemini", windowKind: "five_hour", label: "Gemini Pool", remainingPercent: 65, usedPercent: 35, resetsAt: "2026-08-29T05:00:00Z", capturedAt: "2026-08-29T00:00:00Z" }],
    });
    const user = userEvent.setup();
    renderWithProviders(<UsageMonitorPage />);
    await user.click(await screen.findByRole("combobox", { name: "Select account" }));
    expect(await screen.findByRole("option", { name: "Google AI Pro" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Antigravity" })).toBeInTheDocument();
  });

  it("explains a hosted Gemini provider outage without removing the selected source", async () => {
    getGeminiUsageMonitorMock.mockResolvedValue({
      configured: true,
      lastAttemptAt: "2026-09-01T15:00:00Z",
      lastSuccessAt: null,
      lastError: "upstream_unavailable",
      windows: [],
    });
    const user = userEvent.setup();
    renderWithProviders(<UsageMonitorPage />);

    await user.click(await screen.findByRole("combobox", { name: "Select account" }));
    await user.click(await screen.findByRole("option", { name: "Google AI Pro" }));

    expect(await screen.findByText("Atualização automática indisponível neste provedor.")).toBeInTheDocument();
  });
});
