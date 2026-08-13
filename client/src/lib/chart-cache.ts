/**
 * Browser-side chart + cover warm cache.
 * - Chart JSON in localStorage (survives reload)
 * - Instant stale-while-revalidate on open
 * - Covers: Cache Storage + Image prefetch (free, no CF paid products)
 */
import type { ChartPayload, ChartPlatform, ChartPlatformId, Track } from "./types";
import { warmTrackCovers } from "./cover-browser-cache";
import { getTimed, prunePrefix, setTimed } from "./cache-store";
import { coverUrl } from "./player-core";

const CHART_PREFIX = "kazam.v2.chartCache.";
const PLATFORMS_KEY = "kazam.v2.chartPlatforms";
/** Align with server: charts update ~daily */
const TTL_MS = 12 * 60 * 60 * 1000; // 12h fresh
/** Serve stale while revalidating */
const STALE_MS = 36 * 60 * 60 * 1000; // 36h still paint
const MAX_CACHED_PLATFORMS = 8;

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
  const hit = getTimed<ChartPayload>(chartKey(String(platform), board), TTL_MS, STALE_MS);
  if (!hit?.data?.tracks?.length) return null;
  return {
    payload: hit.data,
    stale: hit.stale,
    ageMs: hit.ageMs,
  };
}

export function setCachedChart(payload: ChartPayload) {
  if (!payload?.platform || !payload.tracks?.length) return;
  setTimed(chartKey(String(payload.platform), payload.board || "soar"), payload);
  prunePrefix(CHART_PREFIX, MAX_CACHED_PLATFORMS);
}

export function getCachedPlatforms(): ChartPlatform[] | null {
  const hit = getTimed<ChartPlatform[]>(PLATFORMS_KEY, STALE_MS, STALE_MS);
  if (!hit?.data?.length) return null;
  return hit.data;
}

export function setCachedPlatforms(list: ChartPlatform[]) {
  if (!list?.length) return;
  setTimed(PLATFORMS_KEY, list);
}

/** Prefetch list thumbs via CDN Image() only — no second Image() and no /api/cover-proxy. */
export function prefetchCovers(tracks: Track[], limit = 40) {
  // Always thumb — never warm multi‑MB album art for lists
  warmTrackCovers(tracks, limit);
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
