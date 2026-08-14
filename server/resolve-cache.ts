/**
 * D1 short-TTL cache for resolved play URLs (metadata only, no audio bytes).
 * Signed CDN links expire — default ~18 minutes, then re-resolve and upsert.
 */
/// <reference types="@cloudflare/workers-types" />

export type ResolveCacheRow = {
  sid: string;
  level: string;
  url: string;
  br: number;
  size: number;
  name: string;
  artist: string;
  cover: string;
  source: string;
  expires_at: number;
  updated_at: number;
};

/** Keep under typical signed-URL lifetime; client durable cache is ~25m. */
export const RESOLVE_TTL_SEC = 18 * 60;

const resolveSchemaReady = new WeakMap<D1Database, Promise<void>>();

export async function ensureResolveCacheSchema(db: D1Database): Promise<void> {
  let p = resolveSchemaReady.get(db);
  if (p) return p;
  p = (async () => {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS resolve_cache (
      sid TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL,
      br INTEGER DEFAULT 0,
      size INTEGER DEFAULT 0,
      name TEXT DEFAULT '',
      artist TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      source TEXT DEFAULT 'remote',
      expires_at REAL NOT NULL,
      updated_at REAL NOT NULL,
      PRIMARY KEY (sid, level)
    )`),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_resolve_expires ON resolve_cache(expires_at)`
    ),
  ]);
  })().catch((e) => {
    resolveSchemaReady.delete(db);
    throw e;
  });
  resolveSchemaReady.set(db, p);
  return p;
}

function normLevel(level?: string | null): string {
  return String(level || "").trim().toLowerCase() || "default";
}

export async function getResolveCache(
  db: D1Database,
  sid: string | number,
  level?: string | null
): Promise<ResolveCacheRow | null> {
  const s = String(sid);
  const lv = normLevel(level);
  try {
    const now = Date.now() / 1000;
    const row = await db
      .prepare(
        `SELECT sid, level, url, br, size, name, artist, cover, source, expires_at, updated_at
         FROM resolve_cache WHERE sid=? AND level=? AND expires_at > ? LIMIT 1`
      )
      .bind(s, lv, now)
      .first<ResolveCacheRow>();
    if (!row?.url || !/^https?:\/\//i.test(row.url)) return null;
    return row;
  } catch {
    return null;
  }
}

/** All non-expired levels for a song (for qualities menu). */
export async function listResolveCache(
  db: D1Database,
  sid: string | number,
  limit = 8
): Promise<ResolveCacheRow[]> {
  const s = String(sid);
  try {
    const now = Date.now() / 1000;
    const { results } = await db
      .prepare(
        `SELECT sid, level, url, br, size, name, artist, cover, source, expires_at, updated_at
         FROM resolve_cache WHERE sid=? AND expires_at > ? ORDER BY updated_at DESC LIMIT ?`
      )
      .bind(s, now, limit)
      .all<ResolveCacheRow>();
    return (results || []).filter(
      (r: ResolveCacheRow) => r?.url && /^https?:\/\//i.test(r.url)
    );
  } catch {
    return [];
  }
}

export async function putResolveCache(
  db: D1Database,
  row: {
    sid: string | number;
    level?: string | null;
    url: string;
    br?: number;
    size?: number;
    name?: string;
    artist?: string;
    cover?: string;
    source?: string;
    ttlSec?: number;
  }
): Promise<void> {
  if (!row.url || !/^https?:\/\//i.test(row.url)) return;
  const s = String(row.sid);
  const lv = normLevel(row.level);
  const now = Date.now() / 1000;
  const ttl = row.ttlSec ?? RESOLVE_TTL_SEC;
  try {
    await db
      .prepare(
        `INSERT INTO resolve_cache
         (sid, level, url, br, size, name, artist, cover, source, expires_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(sid, level) DO UPDATE SET
           url=excluded.url,
           br=excluded.br,
           size=excluded.size,
           name=excluded.name,
           artist=excluded.artist,
           cover=excluded.cover,
           source=excluded.source,
           expires_at=excluded.expires_at,
           updated_at=excluded.updated_at`
      )
      .bind(
        s,
        lv,
        row.url,
        Number(row.br || 0),
        Number(row.size || 0),
        String(row.name || ""),
        String(row.artist || ""),
        String(row.cover || ""),
        String(row.source || "remote"),
        now + ttl,
        now
      )
      .run();
  } catch {
    /* schema race / quota */
  }
}

/** Drop expired rows opportunistically (cheap free-tier hygiene). */
export async function pruneResolveCache(
  db: D1Database,
  keepMax = 800
): Promise<void> {
  try {
    const now = Date.now() / 1000;
    await db
      .prepare(`DELETE FROM resolve_cache WHERE expires_at <= ?`)
      .bind(now)
      .run();
    // Cap table size if free D1 grows large
    const row = await db
      .prepare(`SELECT COUNT(*) AS c FROM resolve_cache`)
      .first<{ c: number }>();
    const c = Number(row?.c || 0);
    if (c > keepMax) {
      await db
        .prepare(
          `DELETE FROM resolve_cache WHERE rowid IN (
            SELECT rowid FROM resolve_cache ORDER BY updated_at ASC LIMIT ?
          )`
        )
        .bind(c - keepMax)
        .run();
    }
  } catch {
    /* */
  }
}
