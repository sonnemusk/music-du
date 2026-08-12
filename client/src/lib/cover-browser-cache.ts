/**
 * Browser cover cache — free, no server product required.
 * Prefers direct CDN URLs for paint; warms same-origin proxy into Cache Storage.
 */
import { coverProxyUrl, coverUrl, type CoverSize } from "./player-core";
import type { Track } from "./types";

const CACHE_NAME = "kazam-covers-v3";
const warmed = new Set<string>();
/** F-3: cap Cache Storage entries (approx LRU via delete oldest keys list). */
const CACHE_MAX_ENTRIES = 200;
const cacheOrder: string[] = [];

function canCache(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined";
}

function saveDataMode(): boolean {
  try {
    const c = (navigator as any).connection;
    if (!c) return false;
    if (c.saveData) return true;
    const t = String(c.effectiveType || "");
    return t.includes("2g");
  } catch {
    return false;
  }
}

async function pruneCache(cache: Cache): Promise<void> {
  while (cacheOrder.length > CACHE_MAX_ENTRIES) {
    const old = cacheOrder.shift();
    if (!old) break;
    try {
      await cache.delete(old);
    } catch {
      /* */
    }
  }
}

async function openCache(): Promise<Cache | null> {
  if (!canCache()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Warm proxy URL into Cache Storage (and browser HTTP cache). */
export async function warmCoverProxy(proxySrc: string): Promise<void> {
  if (!proxySrc || warmed.has(proxySrc)) return;
  warmed.add(proxySrc);
  const cache = await openCache();
  try {
    if (cache) {
      const hit = await cache.match(proxySrc);
      if (hit && hit.ok) return;
    }
    // Never force-cache: a prior 404 must not stick forever
    const res = await fetch(proxySrc, {
      credentials: "same-origin",
      cache: "default",
    });
    if (!res.ok) {
      warmed.delete(proxySrc);
      return;
    }
    if (cache && !saveDataMode()) {
      try {
        await cache.put(proxySrc, res.clone());
        const ix = cacheOrder.indexOf(proxySrc);
        if (ix >= 0) cacheOrder.splice(ix, 1);
        cacheOrder.push(proxySrc);
        await pruneCache(cache);
      } catch {
        /* quota */
      }
    }
  } catch {
    warmed.delete(proxySrc);
  }
}

export function warmCoverFromRemote(
  remoteUrl?: string,
  size: CoverSize = "thumb"
): void {
  if (!remoteUrl) return;
  // Prefer warming direct URL via img/network; also warm proxy for offline
  const direct = coverUrl(remoteUrl, size);
  const proxy = coverProxyUrl(remoteUrl, size);
  if (direct && !direct.startsWith("/")) {
    // lightweight: browser HTTP cache via Image()
    try {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.src = direct;
    } catch {
      /* */
    }
  }
  if (proxy) void warmCoverProxy(proxy);
}

/** Warm many track covers — always thumb (list / chart / queue). */
export function warmTrackCovers(tracks: Track[], limit = 40): void {
  const list = tracks.slice(0, limit);
  list.forEach((t, i) => {
    if (!t.cover) return;
    const key = coverUrl(t.cover, "thumb") || t.cover;
    if (warmed.has(key)) return;
    // Cap concurrency: first 8 immediate, rest staggered
    if (i < 8) warmCoverFromRemote(t.cover, "thumb");
    else setTimeout(() => warmCoverFromRemote(t.cover, "thumb"), 60 * (i - 7));
  });
}

/**
 * Resolve a display URL: Cache Storage proxy blob if present, else direct CDN.
 */
export async function resolveCoverDisplayUrl(
  remoteOrProxy: string,
  size: CoverSize = "thumb"
): Promise<string> {
  if (!remoteOrProxy) return "";
  const direct = remoteOrProxy.startsWith("/")
    ? remoteOrProxy
    : coverUrl(remoteOrProxy, size);
  const proxy = remoteOrProxy.startsWith("/api/cover-proxy")
    ? remoteOrProxy
    : coverProxyUrl(remoteOrProxy, size);

  // Prefer already-cached proxy blob for instant paint after first visit
  if (proxy) {
    const cache = await openCache();
    if (cache) {
      try {
        const hit = await cache.match(proxy);
        if (hit && hit.ok) {
          const blob = await hit.blob();
          if (blob.size > 32 && blob.type.startsWith("image/")) {
            return URL.createObjectURL(blob);
          }
        }
      } catch {
        /* */
      }
    }
    void warmCoverProxy(proxy);
  }
  return direct || proxy || "";
}
