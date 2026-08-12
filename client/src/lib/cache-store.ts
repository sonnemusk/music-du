/**
 * Shared localStorage TTL bag (F-10f).
 * Callers keep domain logic; this owns wrap/read/write/prune.
 */

export type TimedEntry<T> = { at: number; data: T };

export type CacheStoreOptions = {
  /** Full localStorage key, or prefix when using multi-key mode via keyFor */
  key?: string;
  /** Soft freshness TTL (ms). get returns stale:true when exceeded but still < staleMs */
  ttlMs: number;
  /** Hard expiry — get returns null after this age (default = ttlMs) */
  staleMs?: number;
  /** Max entries when using a key prefix + pruneByPrefix */
  maxEntries?: number;
};

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readTimedEntry<T>(key: string): TimedEntry<T> | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    const w = JSON.parse(raw) as TimedEntry<T>;
    if (!w || typeof w.at !== "number" || w.data == null) return null;
    return w;
  } catch {
    return null;
  }
}

export function writeTimedEntry<T>(key: string, data: T): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify({ at: Date.now(), data } satisfies TimedEntry<T>));
  } catch {
    /* quota / private mode */
  }
}

export function removeEntry(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    /* */
  }
}

/** Result of get with soft/hard TTL */
export type TimedHit<T> = {
  data: T;
  ageMs: number;
  /** past soft ttl but still within hard stale window */
  stale: boolean;
};

/**
 * Read one timed entry. Returns null if missing or past hard expiry (staleMs).
 */
export function getTimed<T>(
  key: string,
  ttlMs: number,
  staleMs: number = ttlMs
): TimedHit<T> | null {
  const w = readTimedEntry<T>(key);
  if (!w) return null;
  const ageMs = Date.now() - w.at;
  if (ageMs > staleMs) return null;
  return { data: w.data, ageMs, stale: ageMs > ttlMs };
}

export function setTimed<T>(key: string, data: T): void {
  writeTimedEntry(key, data);
}

/**
 * Prune keys with a common prefix, keeping the newest `maxEntries` by `at`.
 */
export function prunePrefix(prefix: string, maxEntries: number): void {
  const ls = storage();
  if (!ls || maxEntries < 1) return;
  try {
    const keys: { k: string; at: number }[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      const w = readTimedEntry(k);
      keys.push({ k, at: w?.at || 0 });
    }
    if (keys.length <= maxEntries) return;
    keys.sort((a, b) => a.at - b.at);
    for (const drop of keys.slice(0, keys.length - maxEntries)) {
      ls.removeItem(drop.k);
    }
  } catch {
    /* */
  }
}

/**
 * Map-in-one-key store: entire Record under one LS key, prune by ts field.
 */
export function readMapStore<T extends { ts?: number }>(
  key: string
): Record<string, T> {
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function writeMapStore<T extends { ts?: number }>(
  key: string,
  map: Record<string, T>,
  opts: { ttlMs: number; max: number; now?: number }
): void {
  const now = opts.now ?? Date.now();
  try {
    const entries = Object.entries(map)
      .filter(([, v]) => v && now - (v.ts || 0) <= opts.ttlMs)
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0))
      .slice(0, opts.max);
    const next: Record<string, T> = {};
    for (const [k, v] of entries) next[k] = v;
    storage()?.setItem(key, JSON.stringify(next));
  } catch {
    /* */
  }
}
