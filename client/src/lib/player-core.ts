import type { LyricLine, PlayMode } from "./types";

export function cyclePlayMode(mode: PlayMode): PlayMode {
  if (mode === "list") return "single";
  if (mode === "single") return "shuffle";
  return "list";
}

export function playModeLabel(mode: PlayMode): string {
  return (
    { list: "列表循环", single: "单曲循环", shuffle: "随机播放" }[mode] || "列表循环"
  );
}

/** Pick a random queue index ≠ cur (for shuffle). */
export function pickShuffleIndex(cur: number, len: number): number {
  if (!len || len < 1) return -1;
  if (len === 1) return 0;
  let idx = Math.floor(Math.random() * len);
  if (cur >= 0 && idx === cur) idx = (idx + 1) % len;
  return idx;
}

/**
 * Predict the *next* track index (delta +1 only) so we can prefetch it.
 * For shuffle this is a sticky pick — store it until user advances.
 */
export function predictNextIndex(cur: number, len: number, mode: PlayMode): number {
  if (!len || len < 1) return -1;
  if (mode === "single") return cur >= 0 ? cur : 0;
  if (mode === "shuffle") return pickShuffleIndex(cur, len);
  if (cur < 0) return 0;
  return (cur + 1) % len;
}

export function nextQueueIndex(
  cur: number,
  len: number,
  mode: PlayMode,
  delta: number
): number {
  if (!len || len < 1) return -1;
  if (mode === "single" && delta === 1 && cur >= 0) return cur;
  if (mode === "shuffle") {
    // Forward: random. Back: caller should use shuffle play-history stack;
    // this fallback only applies when history is empty.
    if (delta < 0) {
      if (cur < 0) return 0;
      return (cur + delta + len) % len;
    }
    return pickShuffleIndex(cur, len);
  }
  if (cur < 0) return 0;
  return (cur + delta + len) % len;
}

const SHUFFLE_HISTORY_MAX = 80;

/** Push a played track id (no consecutive duplicates). */
export function pushShuffleHistory(hist: string[], id: string | number): string[] {
  const s = String(id ?? "");
  if (!s) return hist || [];
  const h = hist || [];
  if (h.length && h[h.length - 1] === s) return h;
  const next = [...h, s];
  return next.length > SHUFFLE_HISTORY_MAX
    ? next.slice(next.length - SHUFFLE_HISTORY_MAX)
    : next;
}

/** Pop most recently played id (for 上一首 in shuffle). */
export function popShuffleHistory(hist: string[]): {
  id: string | null;
  rest: string[];
} {
  const h = hist || [];
  if (!h.length) return { id: null, rest: [] };
  return { id: h[h.length - 1]!, rest: h.slice(0, -1) };
}

export function parseLyric(lrc: string, tlrc = ""): LyricLine[] {
  const om = new Map<number, string>();
  const tm = new Map<number, string>();
  const re = /\[(\d+):(\d+(?:\.\d+)?)\](.*)/g;
  let m: RegExpExecArray | null;
  if (lrc) {
    while ((m = re.exec(lrc)) !== null) {
      const ms = parseInt(m[1], 10) * 60000 + Math.round(parseFloat(m[2]) * 1000);
      const tx = m[3].trim();
      if (tx) om.set(ms, tx);
    }
  }
  if (tlrc) {
    re.lastIndex = 0;
    while ((m = re.exec(tlrc)) !== null) {
      const ms = parseInt(m[1], 10) * 60000 + Math.round(parseFloat(m[2]) * 1000);
      const tx = m[3].trim();
      if (tx) tm.set(ms, tx);
    }
  }
  const keys = new Set([...om.keys(), ...tm.keys()]);
  return [...keys]
    .sort((a, b) => a - b)
    .map((ms) => ({ ms, orig: om.get(ms) || "", tran: tm.get(ms) || "" }));
}

export function lyricIndexAt(lines: LyricLine[], posMs: number): number {
  if (!lines.length) return -1;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].ms <= posMs) idx = i;
    else break;
  }
  return idx;
}

export function fmtTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Cover display size for NetEase CDNs (music.126.net):
 * - thumb  ~ list rows (≈40–56px UI → 120px 2x)
 * - medium ~ now-playing / dock / media session
 * - full   ~ immersive background (original, no param)
 */
export type CoverSize = "thumb" | "medium" | "full";

const COVER_PX: Record<CoverSize, number | null> = {
  thumb: 120,
  medium: 400,
  full: null,
};

/** Rewrite remote cover URL to a sized variant when the CDN supports it. */
export function withCoverSize(url: string, size: CoverSize = "thumb"): string {
  if (!url || !/^https?:\/\//i.test(url)) return url || "";
  // Strip existing NetEase-style param=
  let base = url.replace(/([?&])param=\d+y\d+/gi, "$1").replace(/[?&]$/, "");
  base = base.replace(/\?&/, "?").replace(/\?$/, "");

  const px = COVER_PX[size];
  // Only music.126.net reliably supports ?param=NyN
  if (px == null || !/music\.126\.net/i.test(base)) {
    return size === "full" ? base : base; // non-NE: keep as-is for all sizes
  }
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}param=${px}y${px}`;
}

/**
 * Prefer direct CDN for display (fast in CN; NetEase allows no-referrer).
 * Same-origin proxy is only used as fallback / Cache Storage key.
 * @param size default thumb — list-friendly; pass medium/full for large UI
 */
export function coverUrl(url?: string, size: CoverSize = "thumb"): string {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  return withCoverSize(url, size);
}

/** Same-origin proxy URL (fallback when direct CDN fails / blocked). */
export function coverProxyUrl(url?: string, size: CoverSize = "thumb"): string {
  if (!url) return "";
  if (url.startsWith("/api/cover-proxy")) return url;
  if (url.startsWith("/")) return url;
  const remote = withCoverSize(url, size);
  return `/api/cover-proxy?url=${encodeURIComponent(remote)}`;
}

/** True when keyboard shortcuts must not hijack keys (typing / form controls). */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  const el = target as HTMLElement;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  if (el.closest("[contenteditable='true']")) return true;
  // role=searchbox / combobox
  const role = el.getAttribute("role");
  if (role === "textbox" || role === "searchbox" || role === "combobox") return true;
  return false;
}

/** Relative seek: clamp to [0, duration]. */
export function clampSeek(current: number, delta: number, duration: number): number {
  if (!isFinite(duration) || duration <= 0) return Math.max(0, current + delta);
  return Math.max(0, Math.min(duration, current + delta));
}

/**
 * How far media is buffered ahead (0–1), from HTMLMediaElement.buffered.
 * blob: / fully local sources report 1.
 */
export function bufferedRatio(audio: HTMLMediaElement | null | undefined): number {
  if (!audio) return 0;
  const src = audio.currentSrc || audio.src || "";
  if (src.startsWith("blob:") || src.startsWith("data:")) return 1;
  const d = audio.duration;
  if (!d || !isFinite(d) || d <= 0) return 0;
  const ranges = audio.buffered;
  if (!ranges || ranges.length === 0) return 0;
  let maxEnd = 0;
  for (let i = 0; i < ranges.length; i++) {
    try {
      maxEnd = Math.max(maxEnd, ranges.end(i));
    } catch {
      /* InvalidStateError while loading */
    }
  }
  return Math.max(0, Math.min(1, maxEnd / d));
}

export function clampVolume(v: number): number {
  if (!isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}
