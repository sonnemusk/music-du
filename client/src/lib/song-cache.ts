/**
 * Song resolve cache — dual layer:
 * 1) In-memory Map (fast, TTL short for hot re-clicks)
 * 2) localStorage durable (survives reload; longer TTL)
 *
 * CDN signed URLs expire; durable TTL is ~25 min so we re-resolve
 * before typical signed-link death without hammering the API.
 */

export type CachedSong = {
  id: string;
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

const MEMORY_TTL_MS = 8 * 60 * 1000;
const DURABLE_TTL_MS = 25 * 60 * 1000;
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

/** Hydrate memory from localStorage once (call on bootstrap). */
export function hydrateSongCache(): void {
  if (durableHydrated) return;
  durableHydrated = true;
  const map = readDurableMap();
  const now = Date.now();
  for (const [k, v] of Object.entries(map)) {
    if (!v || typeof v !== "object") continue;
    if (now - (v.ts || 0) > DURABLE_TTL_MS) continue;
    if (!memory.has(k)) memory.set(k, { ...v, id: String(v.id || k) });
  }
}

export function getCachedSong(id: string | number): CachedSong | null {
  const k = String(id);
  const mem = memory.get(k);
  if (mem) {
    if (isFresh(mem, MEMORY_TTL_MS)) return mem;
    // Memory expired but durable may still be OK — fall through check
    if (!isFresh(mem, DURABLE_TTL_MS)) {
      memory.delete(k);
    } else {
      return mem; // still usable for play (CDN may or may not work; stream fallback exists)
    }
  }

  // Lazy durable lookup (sync)
  const map = readDurableMap();
  const hit = map[k];
  if (!hit || !isFresh(hit, DURABLE_TTL_MS)) {
    if (hit) {
      delete map[k];
      writeDurableMap(map);
    }
    return null;
  }
  memory.set(k, hit);
  return hit;
}

export function setCachedSong(data: Omit<CachedSong, "ts">) {
  const entry: CachedSong = { ...data, id: String(data.id), ts: Date.now() };
  memory.set(entry.id, entry);
  const map = readDurableMap();
  map[entry.id] = entry;
  writeDurableMap(map);
}

/** Drop one entry so the next play re-resolves (stale / dead CDN link). */
export function invalidateCachedSong(id: string | number) {
  const k = String(id);
  memory.delete(k);
  try {
    const map = readDurableMap();
    if (map[k]) {
      delete map[k];
      writeDurableMap(map);
    }
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
