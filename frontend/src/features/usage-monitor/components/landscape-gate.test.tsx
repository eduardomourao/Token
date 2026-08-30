import { renderWithProviders } from "@/test/utils";
import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandscapeGate } from "./landscape-gate";

const originalMatchMedia = window.matchMedia;

function setPortrait(portrait: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(orientation: portrait)" ? portrait : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("LandscapeGate", () => {
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("replaces dashboard content with a rotation message in portrait", () => {
    setPortrait(true);
    renderWithProviders(<LandscapeGate><div>dashboard</div></LandscapeGate>);

    expect(screen.getByText("Rotate your device to landscape 📱↔️")).toBeInTheDocument();
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });

  it("renders children in landscape", () => {
    setPortrait(false);
    renderWithProviders(<LandscapeGate><div>dashboard</div></LandscapeGate>);

    expect(screen.getByText("dashboard")).toBeInTheDocument();
  });
});
