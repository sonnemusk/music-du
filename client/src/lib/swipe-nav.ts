/**
 * Horizontal swipe → prev/next track (touch only).
 * Does not use any paid Cloudflare services.
 */

export type SwipeHandlers = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

const MIN_DX = 56;
const MAX_DY = 48;

export function attachSwipeNav(
  el: HTMLElement,
  handlers: SwipeHandlers
): () => void {
  let x0 = 0;
  let y0 = 0;
  let tracking = false;

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    tracking = true;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  };

  const onEnd = (e: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    if (Math.abs(dx) < MIN_DX) return;
    if (Math.abs(dy) > MAX_DY) return; // vertical scroll
    if (dx < 0) handlers.onSwipeLeft?.();
    else handlers.onSwipeRight?.();
  };

  const onCancel = () => {
    tracking = false;
  };

  el.addEventListener("touchstart", onStart, { passive: true });
  el.addEventListener("touchend", onEnd, { passive: true });
  el.addEventListener("touchcancel", onCancel, { passive: true });

  return () => {
    el.removeEventListener("touchstart", onStart);
    el.removeEventListener("touchend", onEnd);
    el.removeEventListener("touchcancel", onCancel);
  };
}
