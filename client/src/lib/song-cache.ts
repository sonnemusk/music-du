/**
 * Song resolve cache — dual layer:
 * 1) In-memory Map (fast, TTL short for hot re-clicks)
 * 2) localStorage durable (survives reload; longer TTL)
 *
 * Keys are `${id}@@${preferredLevel}` so quality switches re-resolve cleanly.
 * CDN signed URLs expire; durable TTL is ~25 min.
 */

import { DEFAULT_QUALITY, songCacheKey } from "./quality";

export type CachedSong = {
  id: string;
  /** Preferred level used when this entry was resolved */
  preferredLevel?: string;
  url: string;
  stream: string;
  level: string;
  br: number;
  size: number;
  name: string;
  artist: string;
  cover: string;
  source: string;
  play?: { mode?: string; src?: string };
  ts: number;
};

/** Align with D1 resolve_cache (~18m) so client doesn't outlive edge signed URLs too long */
const MEMORY_TTL_MS = 10 * 60 * 1000;
const DURABLE_TTL_MS = 20 * 60 * 1000;
const LS_KEY = "kazam.v2.songResolve";
const LS_MAX = 80;

const memory = new Map<string, CachedSong>();
let durableHydrated = false;

function isFresh(hit: CachedSong, ttl: number): boolean {
  return Date.now() - hit.ts <= ttl;
}

function readDurableMap(): Record<string, CachedSong> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedSong>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeDurableMap(map: Record<string, CachedSong>) {
  try {
    const entries = Object.entries(map)
      .filter(([, v]) => v && isFresh(v, DURABLE_TTL_MS))
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, LS_MAX);
    const next: Record<string, CachedSong> = {};
    for (const [k, v] of entries) next[k] = v;
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
}

function resolveKey(id: string | number, preferredLevel?: string | null): string {
  return songCacheKey(id, preferredLevel || DEFAULT_QUALITY);
}

/** Hydrate memory from localStorage once (call on bootstrap). */
export function hydrateSongCache(): void {
  if (durableHydrated) return;
  durableHydrated = true;
  const map = readDurableMap();
  const now = Date.now();
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v !== "object") continue;
    if (now - (v.ts || 0) > DURABLE_TTL_MS) continue;
    if (!memory.has(k)) memory.set(k, { ...v, id: String(v.id || k.split("@@")[0]) });
  }
}

export function getCachedSong(
  id: string | number,
  preferredLevel?: string | null
): CachedSong | null {
  const k = resolveKey(id, preferredLevel);
  const tryKey = (key: string): CachedSong | null => {
    const mem = memory.get(key);
    if (mem) {
      if (isFresh(mem, MEMORY_TTL_MS)) return mem;
      if (!isFresh(mem, DURABLE_TTL_MS)) {
        memory.delete(key);
      } else {
        return mem;
      }
    }
    const map = readDurableMap();
    const hit = map[key];
    if (!hit || !isFresh(hit, DURABLE_TTL_MS)) {
      if (hit) {
        delete map[key];
        writeDurableMap(map);
      }
      return null;
    }
    memory.set(key, hit);
    return hit;
  };

  const hit = tryKey(k);
  if (hit) return hit;
  // Legacy entries keyed by bare id (pre-quality switch)
  if (!String(id).includes("@@")) {
    return tryKey(String(id));
  }
  return null;
}

export function setCachedSong(
  data: Omit<CachedSong, "ts">,
  preferredLevel?: string | null
) {
  const pref = preferredLevel || data.preferredLevel || data.level || DEFAULT_QUALITY;
  const k = resolveKey(data.id, pref);
  const entry: CachedSong = {
    ...data,
    id: String(data.id),
    preferredLevel: pref,
    ts: Date.now(),
  };
  memory.set(k, entry);
  const map = readDurableMap();
  map[k] = entry;
  writeDurableMap(map);
}

/** Drop one entry so the next play re-resolves (stale / dead CDN link). */
export function invalidateCachedSong(
  id: string | number,
  preferredLevel?: string | null
) {
  const keys = [resolveKey(id, preferredLevel), String(id)];
  if (preferredLevel == null) {
    // wipe all quality variants for this song
    const prefix = `${String(id)}@@`;
    for (const k of memory.keys()) {
      if (k === String(id) || k.startsWith(prefix)) keys.push(k);
    }
    try {
      const map = readDurableMap();
      for (const k of Object.keys(map)) {
        if (k === String(id) || k.startsWith(prefix)) keys.push(k);
      }
    } catch {
      /* */
    }
  }
  const uniq = [...new Set(keys)];
  for (const k of uniq) memory.delete(k);
  try {
    const map = readDurableMap();
    let changed = false;
    for (const k of uniq) {
      if (map[k]) {
        delete map[k];
        changed = true;
      }
    }
    if (changed) writeDurableMap(map);
  } catch {
    /* */
  }
}

export function clearSongCache() {
  memory.clear();
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* */
  }
}

/** Drop only remote URL fields older than ttl (keep stream path). */
export function pruneExpiredRemoteUrls() {
  const map = readDurableMap();
  let changed = false;
  for (const [k, v] of Object.entries(map)) {
    if (!isFresh(v, DURABLE_TTL_MS)) {
      delete map[k];
      memory.delete(k);
      changed = true;
    }
  }
  if (changed) writeDurableMap(map);
}
