/**
 * Horizontal swipe → prev/next track (touch only).
 * M-11: higher threshold; skip [data-no-swipe] ancestors (chips / h-scroll).
 */

export type SwipeHandlers = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

/** Horizontal travel must exceed this (px). */
export const SWIPE_MIN_DX = 60;
/** Require |dx| > ratio * |dy| so vertical scroll does not flip tracks. */
export const SWIPE_DX_OVER_DY = 2;

/** Pure decision for unit tests (M-11). */
export function resolveSwipe(
  dx: number,
  dy: number,
  minDx = SWIPE_MIN_DX,
  dxOverDy = SWIPE_DX_OVER_DY
): "left" | "right" | null {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (adx < minDx) return null;
  if (adx <= dxOverDy * ady) return null;
  return dx < 0 ? "left" : "right";
}

function shouldIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-no-swipe]"));
}

export function attachSwipeNav(
  el: HTMLElement,
  handlers: SwipeHandlers
): () => void {
  let x0 = 0;
  let y0 = 0;
  let tracking = false;

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (shouldIgnoreTarget(e.target)) {
      tracking = false;
      return;
    }
    tracking = true;
    x0 = e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  };

  const onEnd = (e: TouchEvent) => {
    if (!tracking) return;
    tracking = false;
    if (shouldIgnoreTarget(e.target)) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - x0;
    const dy = t.clientY - y0;
    const dir = resolveSwipe(dx, dy);
    if (dir === "left") handlers.onSwipeLeft?.();
    else if (dir === "right") handlers.onSwipeRight?.();
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
