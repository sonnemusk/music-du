/**
 * Background song-URL resolve for search / chart lists.
 * Fills durable song-cache so playTrack hits cache and skips slow /api/song wait.
 * Does NOT download audio — only metadata + CDN url.
 */
import { DEFAULT_QUALITY } from "./quality";
import { getCachedSong, setCachedSong } from "./song-cache";
import type { Track } from "./types";
import {
  isUpstreamBlocked,
  noteUpstreamError,
  noteUpstreamOk,
  waitUpstreamSlot,
} from "./upstream-backoff";

const inflight = new Set<string>();

export type ResolveFn = (
  id: string | number,
  opts?: { level?: string }
) => Promise<{
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
    /** Preferred quality level (default highest) */
    level?: string;
  }
): void {
  const level = opts?.level || DEFAULT_QUALITY;
  const limit = opts?.limit ?? 24;
  const concurrency = Math.max(1, Math.min(4, opts?.concurrency ?? 2));
  const staggerMs = opts?.staggerMs ?? 100;
  const startDelayMs = opts?.startDelayMs ?? 200;

  const list = (tracks || [])
    .filter((t) => t && t.id != null)
    .slice(0, limit)
    .filter((t) => {
      const k = `${String(t.id)}@@${level}`;
      if (getCachedSong(t.id, level)) return false;
      if (inflight.has(k)) return false;
      return true;
    });

  if (!list.length) return;

  const run = async () => {
    let idx = 0;
    const worker = async () => {
      while (idx < list.length) {
        if (isUpstreamBlocked()) {
          const ok = await waitUpstreamSlot();
          if (!ok || isUpstreamBlocked()) break;
        }
        const t = list[idx++];
        if (!t) break;
        const k = `${String(t.id)}@@${level}`;
        if (getCachedSong(t.id, level) || inflight.has(k)) continue;
        inflight.add(k);
        try {
          const meta = await resolveFn(t.id, { level });
          noteUpstreamOk();
          const remote =
            meta?.url && /^https?:\/\//i.test(String(meta.url))
              ? String(meta.url)
              : "";
          setCachedSong(
            {
              id: String(t.id),
              url: remote,
              stream:
                meta?.stream ||
                `/api/stream/${encodeURIComponent(String(t.id))}?level=${encodeURIComponent(level)}`,
              level: String(meta?.level || level),
              br: Number(meta?.br || 0),
              size: Number(meta?.size || 0),
              name: meta?.name || t.name || "",
              artist: meta?.artist || t.artist || "",
              cover: meta?.cover || t.cover || "",
              source: String(meta?.source || ""),
              play: meta?.play,
            },
            level
          );
        } catch (e: any) {
          const msg = String(e?.message || e || "");
          if (/\b429\b|rate.?limit|too many/i.test(msg)) noteUpstreamError(429);
          else if (/\b5\d\d\b|upstream/i.test(msg)) noteUpstreamError(502);
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
  resolveFn: ResolveFn,
  level: string = DEFAULT_QUALITY
): void {
  if (id == null) return;
  const k = `${String(id)}@@${level}`;
  if (getCachedSong(id, level) || inflight.has(k)) return;
  inflight.add(k);
  void (async () => {
    try {
      const meta = await resolveFn(id, { level });
      const remote =
        meta?.url && /^https?:\/\//i.test(String(meta.url))
          ? String(meta.url)
          : "";
      setCachedSong(
        {
          id: String(id),
          url: remote,
          stream:
            meta?.stream ||
            `/api/stream/${encodeURIComponent(String(id))}?level=${encodeURIComponent(level)}`,
          level: String(meta?.level || level),
          br: Number(meta?.br || 0),
          size: Number(meta?.size || 0),
          name: String(meta?.name || ""),
          artist: String(meta?.artist || ""),
          cover: String(meta?.cover || ""),
          source: String(meta?.source || ""),
          play: meta?.play,
        },
        level
      );
    } catch {
      /* */
    } finally {
      inflight.delete(k);
    }
  })();
}
