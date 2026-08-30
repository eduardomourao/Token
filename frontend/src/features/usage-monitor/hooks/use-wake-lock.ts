import { useEffect } from "react";

type WakeLockSentinel = {
  release: () => Promise<void>;
};

type WakeLockApi = {
  request: (type: "screen") => Promise<WakeLockSentinel>;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: WakeLockApi;
};

/** Keeps a dedicated monitor display awake when the browser supports the Screen Wake Lock API. */
export function useWakeLock(): void {
  useEffect(() => {
    let disposed = false;
    let sentinel: WakeLockSentinel | null = null;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;

    if (!wakeLock) return;

    void wakeLock.request("screen")
      .then((requestedSentinel) => {
        sentinel = requestedSentinel;
        if (disposed) {
          void requestedSentinel.release();
        }
      })
      .catch(() => {
        // Wake lock permission and support vary by browser. The dashboard remains usable without it.
      });

    return () => {
      disposed = true;
      if (sentinel) {
        void sentinel.release();
      }
    };
  }, []);
}
