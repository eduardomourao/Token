import { useMemo, useRef } from "react";

type UseSwipeOptions = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
};

const SWIPE_THRESHOLD_PX = 50;

export function useSwipe({ onSwipeLeft, onSwipeRight }: UseSwipeOptions) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const latest = useRef<{ x: number; y: number } | null>(null);

  return useMemo(() => ({
    onTouchStart(event: React.TouchEvent) {
      const touch = event.touches[0];
      if (!touch) return;
      const point = { x: touch.clientX, y: touch.clientY };
      start.current = point;
      latest.current = point;
    },
    onTouchMove(event: React.TouchEvent) {
      const touch = event.touches[0];
      if (!touch || !start.current) return;
      latest.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd(event: React.TouchEvent) {
      const startPoint = start.current;
      const touch = event.changedTouches[0];
      const endPoint = touch ? { x: touch.clientX, y: touch.clientY } : latest.current;
      start.current = null;
      latest.current = null;
      if (!startPoint || !endPoint) return;

      const horizontalDistance = endPoint.x - startPoint.x;
      const verticalDistance = endPoint.y - startPoint.y;
      if (Math.abs(horizontalDistance) < SWIPE_THRESHOLD_PX || Math.abs(horizontalDistance) <= Math.abs(verticalDistance)) return;

      if (horizontalDistance < 0) onSwipeLeft();
      else onSwipeRight();
    },
  }), [onSwipeLeft, onSwipeRight]);
}
