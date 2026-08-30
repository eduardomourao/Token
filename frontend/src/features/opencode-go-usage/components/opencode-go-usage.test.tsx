import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpenCodeGoUsageCard } from "@/features/opencode-go-usage/components/opencode-go-usage-card";
import { OpenCodeGoUsageSettings } from "@/features/opencode-go-usage/components/opencode-go-usage-settings";
import { useOpenCodeGoUsage } from "@/features/opencode-go-usage/hooks/use-opencode-go-usage";

vi.mock("@/features/opencode-go-usage/hooks/use-opencode-go-usage", () => ({
  useOpenCodeGoUsage: vi.fn(),
}));
vi.mock("@/features/opencode-go-usage/api", () => ({
  downloadOpenCodeGoUsageCsv: vi.fn(),
}));

const useMonitorMock = useOpenCodeGoUsage as unknown as ReturnType<typeof vi.fn>;

function monitor(configured: boolean) {
  return {
    configured,
    lastAttemptAt: "2026-08-29T12:00:00Z",
    lastSuccessAt: "2026-08-29T12:00:00Z",
    lastError: configured ? "upstream_unavailable" : null,
    windows: configured
      ? [
          { window: "rolling", remainingPercent: 88, usedPercent: 12, resetsAt: "2026-08-29T14:00:00Z", capturedAt: "2026-08-29T12:00:00Z" },
          { window: "weekly", remainingPercent: 66, usedPercent: 34, resetsAt: "2026-09-01T12:00:00Z", capturedAt: "2026-08-29T12:00:00Z" },
          { window: "monthly", remainingPercent: 44, usedPercent: 56, resetsAt: "2026-10-01T12:00:00Z", capturedAt: "2026-08-29T12:00:00Z" },
        ]
      : [],
  };
}

function setup(configured: boolean) {
  return {
    monitorQuery: { data: monitor(configured), error: null, isPending: false },
    configureMutation: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, error: null },
    refreshMutation: { mutate: vi.fn(), isPending: false, error: null },
    clearMutation: { mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, error: null },
  };
}

describe("OpenCode Go usage UI", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a configuration action while no key is present", () => {
    useMonitorMock.mockReturnValue(setup(false));
    const onConfigure = vi.fn();

    render(<OpenCodeGoUsageCard canWrite onConfigure={onConfigure} />);

    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onConfigure).toHaveBeenCalledOnce();
  });

  it("shows the three retained readings and a stale state", () => {
    const hooks = setup(true);
    useMonitorMock.mockReturnValue(hooks);

    render(<OpenCodeGoUsageCard canWrite onConfigure={vi.fn()} />);

    expect(screen.getByText("88.0%")).toBeInTheDocument();
    expect(screen.getByText("66.0%")).toBeInTheDocument();
    expect(screen.getByText("44.0%")).toBeInTheDocument();
    expect(screen.getByText(/could not be refreshed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
    expect(hooks.refreshMutation.mutate).toHaveBeenCalledOnce();
  });

  it("does not present an empty monitor while the initial state is loading", () => {
    const hooks = setup(false);
    useMonitorMock.mockReturnValue({
      ...hooks,
      monitorQuery: { data: undefined, error: null, isPending: true },
    } as never);

    render(<OpenCodeGoUsageCard canWrite onConfigure={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading OpenCode Go usage monitor");
    expect(screen.queryByText(/Add an OpenCode Go key/i)).not.toBeInTheDocument();
  });

  it("accepts a replacement key without rendering its value and supports removal", async () => {
    const hooks = setup(true);
    useMonitorMock.mockReturnValue(hooks);
    render(<OpenCodeGoUsageSettings disabled={false} />);

    const field = screen.getByLabelText("OpenCode Go API key");
    fireEvent.change(field, { target: { value: "go-sensitive-value" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace key" }));
    await waitFor(() => expect(hooks.configureMutation.mutateAsync).toHaveBeenCalledWith("go-sensitive-value"));
    expect(screen.queryByText("go-sensitive-value")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove key" }));
    await waitFor(() => expect(hooks.clearMutation.mutateAsync).toHaveBeenCalledOnce());
  });
});
