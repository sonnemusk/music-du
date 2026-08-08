/**
 * Background song-URL resolve for search / chart lists.
 * Fills durable song-cache so playTrack hits cache and skips slow /api/song wait.
 * Does NOT download audio — only metadata + CDN url.
 */
import { getCachedSong, setCachedSong } from "./song-cache";
import type { Track } from "./types";

const inflight = new Set<string>();

export type ResolveFn = (id: string | number) => Promise<{
  url?: string;
  stream?: string;
  level?: string;
  br?: number;
  size?: number;
  name?: string;
  artist?: string;
  cover?: string;
  source?: string;
  play?: { mode?: string; src?: string };
}>;

/**
 * Prefetch resolve for the first N tracks with low concurrency.
 * Safe to call often; skips cache hits and in-flight ids.
 */
export function prefetchSongResolves(
  tracks: Track[],
  resolveFn: ResolveFn,
  opts?: {
    /** Max tracks to warm (default 12) */
    limit?: number;
    /** Parallel resolves (default 2 — don't hammer upstream) */
    concurrency?: number;
    /** Pause between each resolve in a worker (default 120ms) */
    staggerMs?: number;
    /** Delay before starting (default 280ms — let UI paint first) */
    startDelayMs?: number;
  }
): void {
  const limit = opts?.limit ?? 24;
  const concurrency = Math.max(1, Math.min(4, opts?.concurrency ?? 2));
  const staggerMs = opts?.staggerMs ?? 100;
  const startDelayMs = opts?.startDelayMs ?? 200;

  const list = (tracks || [])
    .filter((t) => t && t.id != null)
    .slice(0, limit)
    .filter((t) => {
      const k = String(t.id);
      if (getCachedSong(k)) return false;
      if (inflight.has(k)) return false;
      return true;
    });

  if (!list.length) return;

  const run = async () => {
    let idx = 0;
    const worker = async () => {
      while (idx < list.length) {
        const t = list[idx++];
        if (!t) break;
        const k = String(t.id);
        if (getCachedSong(k) || inflight.has(k)) continue;
        inflight.add(k);
        try {
          const meta = await resolveFn(t.id);
          const remote =
            meta?.url && /^https?:\/\//i.test(String(meta.url))
              ? String(meta.url)
              : "";
          setCachedSong({
            id: k,
            url: remote,
            stream: meta?.stream || `/api/stream/${encodeURIComponent(k)}`,
            level: String(meta?.level || ""),
            br: Number(meta?.br || 0),
            size: Number(meta?.size || 0),
            name: meta?.name || t.name || "",
            artist: meta?.artist || t.artist || "",
            cover: meta?.cover || t.cover || "",
            source: String(meta?.source || ""),
            play: meta?.play,
          });
        } catch {
          /* skip — play path will resolve again */
        } finally {
          inflight.delete(k);
        }
        if (staggerMs > 0) {
          await new Promise((r) => setTimeout(r, staggerMs));
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  };

  if (startDelayMs > 0) {
    setTimeout(() => void run(), startDelayMs);
  } else {
    void run();
  }
}

/** Hover / focus warm for a single row (search & charts). */
export function prefetchSongResolveOne(
  id: string | number | null | undefined,
  resolveFn: ResolveFn
): void {
  if (id == null) return;
  const k = String(id);
  if (getCachedSong(k) || inflight.has(k)) return;
  inflight.add(k);
  void (async () => {
    try {
      const meta = await resolveFn(id);
      const remote =
        meta?.url && /^https?:\/\//i.test(String(meta.url))
          ? String(meta.url)
          : "";
      setCachedSong({
        id: k,
        url: remote,
        stream: meta?.stream || `/api/stream/${encodeURIComponent(k)}`,
        level: String(meta?.level || ""),
        br: Number(meta?.br || 0),
        size: Number(meta?.size || 0),
        name: String(meta?.name || ""),
        artist: String(meta?.artist || ""),
        cover: String(meta?.cover || ""),
        source: String(meta?.source || ""),
        play: meta?.play,
      });
    } catch {
      /* */
    } finally {
      inflight.delete(k);
    }
  })();
}
