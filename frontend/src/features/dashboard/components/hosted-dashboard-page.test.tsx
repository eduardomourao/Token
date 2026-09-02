import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils";

import { HostedDashboardPage } from "./hosted-dashboard-page";

vi.mock("../hosted-dashboard-read-model", () => ({
  getHostedDashboardReadModel: vi.fn().mockResolvedValue({
    lastSyncAt: "2026-09-01T11:00:00Z",
    accounts: [{
      accountId: "account-a",
      displayName: "Primary",
      email: "operator@example.com",
      planType: "pro",
      status: "active",
      lastRefreshAt: "2026-09-01T09:00:00Z",
      windows: [{ key: "primary", usedPercent: 35, remainingPercent: 65, resetAt: 1_788_301_000 }],
    }],
  }),
}));

describe("HostedDashboardPage", () => {
  it("renders owner-scoped account quotas as a read-only dashboard", async () => {
    renderWithProviders(<HostedDashboardPage />);

    expect(await screen.findByRole("heading", { name: "Dashboard hospedado" })).toBeInTheDocument();
    expect(await screen.findByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("operator@example.com")).toBeInTheDocument();
    expect(screen.getByText("65% disponível")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir monitor de uso" })).toHaveAttribute("href", "/usage-monitor");
    expect(screen.queryByRole("button", { name: /Pausar|Reativar|Excluir/i })).not.toBeInTheDocument();
  });
});
