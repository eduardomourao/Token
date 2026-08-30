import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useSwipe } from "./use-swipe";

function SwipeTarget({ onSwipeLeft, onSwipeRight }: { onSwipeLeft: () => void; onSwipeRight: () => void }) {
  const handlers = useSwipe({ onSwipeLeft, onSwipeRight });
  return <div data-testid="swipe-target" {...handlers} />;
}

describe("useSwipe", () => {
  it("calls the adjacent horizontal direction after a 50px swipe", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    render(<SwipeTarget onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />);
    const target = screen.getByTestId("swipe-target");

    fireEvent.touchStart(target, { touches: [{ clientX: 180, clientY: 60 }] });
    fireEvent.touchMove(target, { touches: [{ clientX: 110, clientY: 62 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 110, clientY: 62 }] });
    fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 50 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 165, clientY: 52 }] });

    expect(onSwipeLeft).toHaveBeenCalledOnce();
    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it("ignores short and vertical-dominant gestures", () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    render(<SwipeTarget onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight} />);
    const target = screen.getByTestId("swipe-target");

    fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 70, clientY: 100 }] });
    fireEvent.touchStart(target, { touches: [{ clientX: 180, clientY: 50 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 110, clientY: 160 }] });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });
});
