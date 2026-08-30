import { renderWithProviders } from "@/test/utils";
import { describe, expect, it, vi } from "vitest";

const { useRegisterSW, toast } = vi.hoisted(() => ({
  useRegisterSW: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("virtual:pwa-register/react", () => ({ useRegisterSW }));
vi.mock("sonner", () => ({ toast }));

import { PwaUpdatePrompt } from "./pwa-update-prompt";

describe("PwaUpdatePrompt", () => {
  it("offers a service worker update when a new version is ready", async () => {
    const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
    useRegisterSW.mockReturnValue({ needRefresh: [true], updateServiceWorker });

    renderWithProviders(<PwaUpdatePrompt />);

    expect(toast).toHaveBeenCalledWith("Update available", expect.objectContaining({
      description: "A new version is ready.",
      duration: Infinity,
    }));
    const options = toast.mock.calls[0]?.[1] as { action: { onClick: () => void } };
    options.action.onClick();
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
