/** Visible slice for a fixed-height virtual list. */
export function visibleWindow(opts: {
  length: number;
  scrollTop: number;
  viewportH: number;
  rowH: number;
  overscan?: number;
}): { start: number; end: number; padTop: number; padBottom: number } {
  const length = Math.max(0, Math.floor(opts.length) || 0);
  const rowH = Math.max(1, opts.rowH || VIRTUAL_ROW_H);
  const overscan = Math.max(0, opts.overscan ?? 8);
  if (!length) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
  const scrollTop = Math.max(0, opts.scrollTop || 0);
  const viewportH = Math.max(0, opts.viewportH || 0);
  const start = Math.min(length, Math.max(0, Math.floor(scrollTop / rowH) - overscan));
  const end = Math.min(length, Math.max(start, Math.ceil((scrollTop + viewportH) / rowH) + overscan));
  return {
    start,
    end,
    padTop: start * rowH,
    padBottom: Math.max(0, (length - end) * rowH),
  };
}

export const VIRTUAL_LIST_MIN = 80;
/** Must match `.track-row { min-height: 64px }` in layouts.css. */
export const VIRTUAL_ROW_H = 64;
export const VIRTUAL_OVERSCAN = 8;
