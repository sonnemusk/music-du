/**
 * Browser cover cache — free, no server product required.
 * Uses Cache Storage API (same origin /api/cover-proxy?...).
 * Always prefer thumb/medium sized proxy URLs — never warm multi‑MB originals for lists.
 */
import { coverUrl, type CoverSize } from "./player-core";
import type { Track } from "./types";

const CACHE_NAME = "kazam-covers-v2";
const warmed = new Set<string>();

function canCache(): boolean {
  return typeof window !== "undefined" && typeof caches !== "undefined";
}

async function openCache(): Promise<Cache | null> {
  if (!canCache()) return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

/** Ensure proxy URL is in Cache Storage (and browser HTTP cache). */
export async function warmCoverProxy(proxySrc: string): Promise<void> {
  if (!proxySrc || warmed.has(proxySrc)) return;
  warmed.add(proxySrc);
  const cache = await openCache();
  try {
    if (cache) {
      const hit = await cache.match(proxySrc);
      if (hit) return;
    }
    const res = await fetch(proxySrc, {
      credentials: "same-origin",
      cache: "force-cache",
    }).catch(async () =>
      fetch(proxySrc, { credentials: "same-origin", cache: "default" })
    );
    if (!res || !res.ok) return;
    if (cache) {
      try {
        await cache.put(proxySrc, res.clone());
      } catch {
        /* quota */
      }
    }
  } catch {
    /* offline */
  }
}

export function warmCoverFromRemote(
  remoteUrl?: string,
  size: CoverSize = "thumb"
): void {
  if (!remoteUrl) return;
  const src = coverUrl(remoteUrl, size);
  if (!src) return;
  void warmCoverProxy(src);
}

/** Warm many track covers — always thumb (list / chart / queue). */
export function warmTrackCovers(tracks: Track[], limit = 40): void {
  const list = tracks.slice(0, limit);
  list.forEach((t, i) => {
    if (!t.cover) return;
    const src = coverUrl(t.cover, "thumb");
    if (!src || warmed.has(src)) return;
    // Cap concurrency: first 6 immediate, rest staggered
    if (i < 6) void warmCoverProxy(src);
    else setTimeout(() => void warmCoverProxy(src), 80 * (i - 5));
  });
}

/**
 * Prefer Cache Storage blob for instant paint; falls back to network URL.
 * Returns object URL that caller should revoke when done (or leave until unmount).
 */
export async function resolveCoverDisplayUrl(
  remoteOrProxy: string,
  size: CoverSize = "thumb"
): Promise<string> {
  if (!remoteOrProxy) return "";
  const src = remoteOrProxy.startsWith("/")
    ? remoteOrProxy
    : coverUrl(remoteOrProxy, size);
  if (!src) return "";
  const cache = await openCache();
  if (cache) {
    try {
      const hit = await cache.match(src);
      if (hit) {
        const blob = await hit.blob();
        if (blob.size > 32) return URL.createObjectURL(blob);
      }
    } catch {
      /* */
    }
  }
  void warmCoverProxy(src);
  return src;
}
