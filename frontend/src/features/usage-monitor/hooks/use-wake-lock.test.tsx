import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWakeLock } from "./use-wake-lock";

function WakeLockProbe() {
  useWakeLock();
  return null;
}

describe("useWakeLock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
  });

  it("requests the screen lock when supported and releases it on unmount", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });

    const result = render(<WakeLockProbe />);
    await act(async () => undefined);

    expect(request).toHaveBeenCalledWith("screen");
    result.unmount();
    await act(async () => undefined);
    expect(release).toHaveBeenCalledOnce();
  });
});
