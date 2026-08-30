import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UsageDonutCard } from "./usage-donut-card";

vi.mock("@/components/donut-chart", () => ({
  DonutChart: ({ items }: { items: Array<{ color?: string }> }) => <div data-testid="compact-usage-donut" data-color={items[0]?.color} />,
}));

describe("UsageDonutCard", () => {
  it.each([
    [50, "#22c55e"],
    [75, "#eab308"],
    [90, "#f97316"],
    [91, "#ef4444"],
  ])("shows %i%% used with the matching usage color", (usedPercent, expectedColor) => {
    render(
      <UsageDonutCard
        title="Daily usage"
        remaining={100 - usedPercent}
        total={100}
        resetAt={null}
        resetLabel="Resets in"
        usedLabel="used"
        remainingLabel="remaining"
      />,
    );

    expect(screen.getByText(`${usedPercent}%`)).toBeInTheDocument();
    expect(screen.getByTestId("compact-usage-donut")).toHaveAttribute("data-color", expectedColor);
  });
});
