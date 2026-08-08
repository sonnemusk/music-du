/**
 * Browser-side chart + cover warm cache.
 * - Chart JSON in localStorage (survives reload)
 * - Instant stale-while-revalidate on open
 * - Covers: Cache Storage + Image prefetch (free, no CF paid products)
 */
import type { ChartPayload, ChartPlatform, ChartPlatformId, Track } from "./types";
import { warmTrackCovers } from "./cover-browser-cache";
import { coverUrl } from "./player-core";

const CHART_PREFIX = "kazam.v2.chartCache.";
const PLATFORMS_KEY = "kazam.v2.chartPlatforms";
/** Align with server: charts update ~daily */
const TTL_MS = 12 * 60 * 60 * 1000; // 12h fresh
/** Serve stale while revalidating */
const STALE_MS = 36 * 60 * 60 * 1000; // 36h still paint
const MAX_CACHED_PLATFORMS = 8;

type Wrapped<T> = { at: number; data: T };

function readWrap<T>(key: string): Wrapped<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const w = JSON.parse(raw) as Wrapped<T>;
    if (!w || typeof w.at !== "number" || w.data == null) return null;
    return w;
  } catch {
    return null;
  }
}

function writeWrap<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota */
  }
}

export type ChartCacheHit = {
  payload: ChartPayload;
  /** true if past soft TTL — still usable for instant paint */
  stale: boolean;
  ageMs: number;
};

function chartKey(platform: string, board = "soar") {
  return CHART_PREFIX + platform + "." + board;
}

export function getCachedChart(
  platform: ChartPlatformId | string,
  board: string = "soar"
): ChartCacheHit | null {
  const w = readWrap<ChartPayload>(chartKey(String(platform), board));
  if (!w?.data?.tracks?.length) return null;
  const ageMs = Date.now() - w.at;
  if (ageMs > STALE_MS) return null;
  return {
    payload: w.data,
    stale: ageMs > TTL_MS,
    ageMs,
  };
}

export function setCachedChart(payload: ChartPayload) {
  if (!payload?.platform || !payload.tracks?.length) return;
  writeWrap(chartKey(String(payload.platform), payload.board || "soar"), payload);
  // prune oldest if too many keys
  try {
    const keys: { k: string; at: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(CHART_PREFIX)) continue;
      const w = readWrap(k);
      keys.push({ k, at: w?.at || 0 });
    }
    if (keys.length > MAX_CACHED_PLATFORMS) {
      keys.sort((a, b) => a.at - b.at);
      for (const drop of keys.slice(0, keys.length - MAX_CACHED_PLATFORMS)) {
        localStorage.removeItem(drop.k);
      }
    }
  } catch {
    /* */
  }
}

export function getCachedPlatforms(): ChartPlatform[] | null {
  const w = readWrap<ChartPlatform[]>(PLATFORMS_KEY);
  if (!w?.data?.length) return null;
  if (Date.now() - w.at > STALE_MS) return null;
  return w.data;
}

export function setCachedPlatforms(list: ChartPlatform[]) {
  if (!list?.length) return;
  writeWrap(PLATFORMS_KEY, list);
}

/** Prefetch cover images so list paint is instant next time / while scrolling. */
const warmed = new Set<string>();

export function prefetchCovers(tracks: Track[], limit = 40) {
  // Always thumb — never warm multi‑MB album art for lists
  warmTrackCovers(tracks, limit);
  if (typeof window === "undefined" || typeof Image === "undefined") return;
  const list = tracks.slice(0, limit);
  list.forEach((t, i) => {
    const raw = t.cover || "";
    if (!raw) return;
    const src = coverUrl(raw, "thumb");
    if (!src || warmed.has(src)) return;
    warmed.add(src);
    const kick = () => {
      try {
        const img = new Image();
        img.decoding = "async";
        img.loading = "eager";
        img.referrerPolicy = "no-referrer";
        img.src = src;
      } catch {
        /* */
      }
    };
    if (i < 6) kick();
    else setTimeout(kick, 90 * (i - 5));
  });
  if (warmed.size > 300) {
    const arr = [...warmed];
    warmed.clear();
    for (const u of arr.slice(-120)) warmed.add(u);
  }
}

/** Warm a single cover. size=medium for now-playing; thumb for list neighbors. */
export function prefetchCover(url?: string, size: "thumb" | "medium" | "full" = "thumb") {
  if (!url) return;
  if (size === "thumb") {
    prefetchCovers([{ id: 0, name: "", artist: "", cover: url }], 1);
    return;
  }
  const src = coverUrl(url, size);
  if (!src || typeof Image === "undefined") return;
  try {
    const img = new Image();
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.src = src;
  } catch {
    /* */
  }
}
