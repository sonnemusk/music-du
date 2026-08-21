/**
 * Horizontal swipe → prev/next track (touch only).
 * Cover surfaces also accept a vertical swipe (up = next, down = prev).
 * M-11: higher threshold; skip [data-no-swipe] ancestors (chips / h-scroll).
 */

export type SwipeHandlers = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export type CoverSwipeHandlers = {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
};

/** Horizontal travel must exceed this (px). */
export const SWIPE_MIN_DX = 60;
/** Require |dx| > ratio * |dy| so vertical scroll does not flip tracks. */
export const SWIPE_DX_OVER_DY = 2;

/** Vertical travel on a cover must exceed this (px). Same as feed reel. */
export const SWIPE_MIN_DY = 56;
/** Require |dy| > ratio * |dx| so a tap / horizontal swipe does not flip tracks. */
export const SWIPE_DY_OVER_DX = 1.25;

/** Lyrics panes and chrome must not steal the cover-page vertical swipe. */
export const COVER_SWIPE_IGNORE =
  "[data-no-swipe], .lyrics-scroller, .lyrics-panel, .pocket-verse, .stage-verse, .dock-now__verse, .feed-verse, .transport";

export function isCoverSwipeIgnoredTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(COVER_SWIPE_IGNORE));
}

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

/** Up = next track, down = previous — same mapping as the feed reel. */
export function resolveVerticalSwipe(
  dx: number,
  dy: number,
  minDy = SWIPE_MIN_DY,
  dyOverDx = SWIPE_DY_OVER_DX
): "up" | "down" | null {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (ady < minDy) return null;
  if (ady <= dyOverDx * adx) return null;
  return dy < 0 ? "up" : "down";
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

function lyricsFaceOpen(el: HTMLElement): boolean {
  const host = el.closest<HTMLElement>("[data-face]");
  if (!host || host.getAttribute("data-face") !== "lyrics") return false;
  // Desktop pocket shows cover | lyrics together; only the verse is ignored.
  if (host.hasAttribute("data-wide")) return false;
  return true;
}

/**
 * Vertical swipe on the cover page (not just the art): up = next, down = prev.
 * Skips lyrics panes / chrome and the lyrics face so the verse can scroll.
 * Swallows the following click so a swipe does not also flip cover → lyrics.
 */
export function attachCoverSwipe(
  el: HTMLElement,
  handlers: CoverSwipeHandlers
): () => void {
  let x0 = 0;
  let y0 = 0;
  let tracking = false;
  let swallowClick = false;

  const onStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    if (isCoverSwipeIgnoredTarget(e.target) || lyricsFaceOpen(el)) {
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
    if (isCoverSwipeIgnoredTarget(e.target) || lyricsFaceOpen(el)) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dir = resolveVerticalSwipe(t.clientX - x0, t.clientY - y0);
    if (!dir) return;
    swallowClick = true;
    if (dir === "up") handlers.onSwipeUp?.();
    else handlers.onSwipeDown?.();
  };

  const onCancel = () => {
    tracking = false;
  };

  const onClick = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };

  el.addEventListener("touchstart", onStart, { passive: true });
  el.addEventListener("touchend", onEnd, { passive: true });
  el.addEventListener("touchcancel", onCancel, { passive: true });
  el.addEventListener("click", onClick, true);

  return () => {
    el.removeEventListener("touchstart", onStart);
    el.removeEventListener("touchend", onEnd);
    el.removeEventListener("touchcancel", onCancel);
    el.removeEventListener("click", onClick, true);
  };
}
