import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test/utils";

import { PwaInstallBanner } from "./pwa-install-banner";

const DISMISSAL_STORAGE_KEY = "codex-lb-pwa-install-dismissed";

function deferredInstallPrompt(outcome: "accepted" | "dismissed" = "accepted") {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const event = new Event("beforeinstallprompt", { cancelable: true }) as BeforeInstallPromptEvent;
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  });
  return { event, prompt };
}

describe("PwaInstallBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("offers installation after the browser provides an install prompt", async () => {
    const user = userEvent.setup();
    const { event, prompt } = deferredInstallPrompt();
    renderWithProviders(<PwaInstallBanner />);

    await act(async () => window.dispatchEvent(event));
    await user.click(await screen.findByRole("button", { name: "Install App" }));

    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Install App" })).not.toBeInTheDocument();
  });

  it("persists a local dismissal and does not show the prompt again", async () => {
    const user = userEvent.setup();
    const { event } = deferredInstallPrompt();
    renderWithProviders(<PwaInstallBanner />);

    await act(async () => window.dispatchEvent(event));
    await user.click(await screen.findByRole("button", { name: "Dismiss" }));

    expect(window.localStorage.getItem(DISMISSAL_STORAGE_KEY)).toBe("true");
    expect(screen.queryByRole("button", { name: "Install App" })).not.toBeInTheDocument();
  });
});
