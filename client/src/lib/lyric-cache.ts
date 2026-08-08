/**
 * Durable lyric cache:
 * 1) In-memory Map (sync, zero latency on re-play / next prefetch)
 * 2) localStorage (survives reload, ~30 days)
 *
 * Lyrics almost never change — once we have them, do NOT re-hit the network.
 */
export type CachedLyric = {
  id: string;
  lrc: string;
  tlrc: string;
  source?: string;
  name?: string;
  artist?: string;
  ts: number;
};

const LS_KEY = "kazam.v2.lyrics";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX = 200;

const memory = new Map<string, CachedLyric>();
/** In-flight network prefetch so we don't double-fetch the same id */
const inflight = new Map<string, Promise<CachedLyric | null>>();

function hasUsable(lrc: string): boolean {
  const s = (lrc || "").trim();
  return s.length >= 8;
}

function isFresh(hit: CachedLyric): boolean {
  return Date.now() - (hit.ts || 0) <= TTL_MS;
}

function readAll(): Record<string, CachedLyric> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CachedLyric>) {
  try {
    const entries = Object.entries(map)
      .filter(([, v]) => v && isFresh(v))
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, MAX);
    const next: Record<string, CachedLyric> = {};
    for (const [k, v] of entries) next[k] = v;
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

/** Call once on bootstrap to hydrate memory from localStorage. */
export function hydrateLyricCache(): void {
  const map = readAll();
  for (const [k, v] of Object.entries(map)) {
    if (v && isFresh(v) && (hasUsable(v.lrc) || hasUsable(v.tlrc || ""))) {
      memory.set(k, { ...v, id: String(v.id || k) });
    }
  }
}

export function getCachedLyric(id: string | number): CachedLyric | null {
  const k = String(id);
  const mem = memory.get(k);
  if (mem) {
    if (!isFresh(mem)) {
      memory.delete(k);
    } else if (hasUsable(mem.lrc) || hasUsable(mem.tlrc || "")) {
      return mem;
    }
  }
  const map = readAll();
  const hit = map[k];
  if (!hit || !isFresh(hit)) {
    if (hit) {
      delete map[k];
      writeAll(map);
    }
    return null;
  }
  if (!hasUsable(hit.lrc) && !hasUsable(hit.tlrc || "")) return null;
  memory.set(k, hit);
  return hit;
}

export function setCachedLyric(
  id: string | number,
  data: { lrc: string; tlrc?: string; source?: string; name?: string; artist?: string }
) {
  if (!hasUsable(data.lrc) && !hasUsable(data.tlrc || "")) return;
  const entry: CachedLyric = {
    id: String(id),
    lrc: data.lrc || "",
    tlrc: data.tlrc || "",
    source: data.source,
    name: data.name,
    artist: data.artist,
    ts: Date.now(),
  };
  memory.set(entry.id, entry);
  const map = readAll();
  map[entry.id] = entry;
  // secondary key by name for rematch reuse
  if (entry.name) {
    const metaKey = `meta:${entry.name.trim().toLowerCase()}`;
    map[metaKey] = entry;
    memory.set(metaKey, entry);
  }
  writeAll(map);
}

/** Also index by name+artist for cross-id reuse after rematch */
export function getCachedLyricByMeta(name?: string, artist?: string): CachedLyric | null {
  const n = (name || "").trim().toLowerCase();
  if (!n) return null;
  const a = (artist || "").trim().toLowerCase().split(/[/,、]/)[0] || "";

  const metaHit = memory.get(`meta:${n}`) || readAll()[`meta:${n}`];
  if (metaHit && isFresh(metaHit) && (hasUsable(metaHit.lrc) || hasUsable(metaHit.tlrc || ""))) {
    if (!a || !metaHit.artist) return metaHit;
    const va = metaHit.artist.toLowerCase();
    if (va.includes(a) || a.includes(va.split(/[/,、]/)[0] || "")) return metaHit;
  }

  const map = { ...Object.fromEntries(memory), ...readAll() };
  let best: CachedLyric | null = null;
  for (const v of Object.values(map)) {
    if (!v || !isFresh(v)) continue;
    if ((v.name || "").trim().toLowerCase() !== n) continue;
    if (a && v.artist) {
      const va = v.artist.toLowerCase();
      if (!va.includes(a) && !a.includes(va.split(/[/,、]/)[0] || "")) continue;
    }
    if (!hasUsable(v.lrc) && !hasUsable(v.tlrc || "")) continue;
    if (!best || (v.ts || 0) > (best.ts || 0)) best = v;
  }
  return best;
}

export type LyricFetchFn = (
  id: string | number,
  opts?: { name?: string; artist?: string; duration?: number }
) => Promise<{ lrc: string; tlrc: string; source?: string; matchedId?: string }>;

/**
 * Prefetch lyrics into cache if missing. Deduped; safe to call often.
 * Does nothing when already cached.
 */
export function prefetchLyric(
  id: string | number,
  meta: { name?: string; artist?: string; duration?: number },
  fetchFn: LyricFetchFn
): void {
  const k = String(id);
  if (getCachedLyric(k) || getCachedLyricByMeta(meta.name, meta.artist)) return;
  if (inflight.has(k)) return;

  const work = (async (): Promise<CachedLyric | null> => {
    try {
      const lyr = await fetchFn(id, {
        name: meta.name,
        artist: meta.artist,
        duration: meta.duration,
      });
      const lrc = lyr?.lrc || "";
      const tlrc = lyr?.tlrc || "";
      if (!hasUsable(lrc) && !hasUsable(tlrc)) return null;
      setCachedLyric(id, {
        lrc,
        tlrc,
        source: lyr.source,
        name: meta.name,
        artist: meta.artist,
      });
      if (lyr.matchedId && String(lyr.matchedId) !== k) {
        setCachedLyric(lyr.matchedId, {
          lrc,
          tlrc,
          source: lyr.source,
          name: meta.name,
          artist: meta.artist,
        });
      }
      return getCachedLyric(id);
    } catch {
      return null;
    } finally {
      inflight.delete(k);
    }
  })();

  inflight.set(k, work);
}

export function isLyricPrefetching(id: string | number): boolean {
  return inflight.has(String(id));
}
