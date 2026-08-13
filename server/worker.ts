/**
 * Cloudflare Workers entry — free-tier first.
 *
 * Rules (product constraints):
 * - No paid products (no R2, paid KV, Image Resizing, paid Workers extras)
 * - Audio: resolve → return remote CDN URL; browser plays direct.
 *   /api/stream only 302-redirects to that URL (no byte proxy, no audio Cache API).
 * - Covers + chart JSON: free Workers Cache API only
 * - Library: optional free D1; without it client keeps localStorage
 */
/// <reference types="@cloudflare/workers-types" />
import { Hono } from "hono";
import {
  chartEdgeMaxAgeSec,
  getChart,
  isChartPlatform,
  listChartBoards,
  listChartPlatforms,
  normalizeBoard,
  type ChartPlatformId,
} from "./charts.js";
import { qualityLadder } from "./config.js";
import * as chksz from "./chksz.js";
import {
  coverErrorResponse,
  fetchCoverUpstream,
  isAllowedCoverUrl,
} from "./cover-fetch.js";
import { edgeMatch, edgePut, withCacheHeaders } from "./edge-cache.js";
import { resolveLyrics } from "./lyrics.js";
import { chooseAudioSrc, resolvePlay } from "./play.js";
import {
  filterNewById,
  minScoreForMatch,
  parseImportPayload,
  scoreNameMatch,
  type FavsExportTrack,
} from "./favs-import.js";
import type { Track } from "./types.js";
import {
  libraryRevisionOk,
  mergeTrackList,
  nextLibraryRevision,
  planHistoryWrites,
  trackListSameIds,
} from "./library-merge.js";
import {
  ensureResolveCacheSchema,
  getResolveCache,
  listResolveCache,
  pruneResolveCache,
  putResolveCache,
} from "./resolve-cache.js";
import { isLibraryReadonly, publicReadonlyLibraryData } from "./site-mode.js";

export type Env = {
  CHKSZ_APIKEY?: string;
  CHKSZ_API_BASE?: string;
  /** Backup host, default https://api.chksz.com */
  CHKSZ_FALLBACK_BASE?: string;
  /** Comma-separated keys for fallback host (round-robin) */
  CHKSZ_FALLBACK_APIKEYS?: string;
  /**
   * Demo / public share: library is read-only; no import/export.
   * Set "true" on demo Worker only — never on a writable production Worker.
   * Private site auth is Cloudflare Access at the edge, not an app token.
   */
  LIBRARY_READONLY?: string;
  ASSETS: Fetcher;
  /** Free D1 library binding MUSIC_DU_DB. */
  MUSIC_DU_DB?: D1Database;
};

/** Push Worker secrets/vars into process.env for chksz/config (nodejs_compat). */
function injectEnv(env: Env) {
  try {
    const pe = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    if (!pe) return;
    if (env.CHKSZ_APIKEY) pe.CHKSZ_APIKEY = env.CHKSZ_APIKEY;
    if (env.CHKSZ_API_BASE) pe.CHKSZ_API_BASE = env.CHKSZ_API_BASE;
    if (env.CHKSZ_FALLBACK_BASE) pe.CHKSZ_FALLBACK_BASE = env.CHKSZ_FALLBACK_BASE;
    if (env.CHKSZ_FALLBACK_APIKEYS) pe.CHKSZ_FALLBACK_APIKEYS = env.CHKSZ_FALLBACK_APIKEYS;
  } catch {
    /* */
  }
}

// Minimal D1 library ops (inline to avoid node:sqlite)
// P1-3: per-D1 schema init once per isolate (WeakMap so multi-db tests stay correct)
const schemaReady = new WeakMap<D1Database, Promise<void>>();

async function ensureSchema(db: D1Database) {
  let p = schemaReady.get(db);
  if (p) return p;
  p = (async () => {
    await ensureResolveCacheSchema(db);
    await db.batch([
      db.prepare(`CREATE TABLE IF NOT EXISTS library_tracks (
      list_type TEXT NOT NULL, sid TEXT NOT NULL, pos INTEGER NOT NULL,
      name TEXT DEFAULT '', artist TEXT DEFAULT '', album TEXT DEFAULT '',
      cover TEXT DEFAULT '', duration INTEGER DEFAULT 0, level TEXT DEFAULT '',
      br INTEGER DEFAULT 0, size INTEGER DEFAULT 0, cached INTEGER DEFAULT 0,
      updated_at REAL DEFAULT 0, PRIMARY KEY (list_type, sid))`),
      db.prepare(`CREATE TABLE IF NOT EXISTS library_meta (
      key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
    ]);
  })().catch((e) => {
    schemaReady.delete(db);
    throw e;
  });
  schemaReady.set(db, p);
  return p;
}

function sanitize(t: any) {
  if (!t || t.id == null || t.id === "") return null;
  return {
    id: t.id,
    name: String(t.name || ""),
    artist: String(t.artist || ""),
    album: String(t.album || ""),
    cover: String(t.cover || ""),
    duration: Number(t.duration || 0),
    level: String(t.level || ""),
    br: Number(t.br || 0),
    size: Number(t.size || 0),
  };
}

async function getMeta(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM library_meta WHERE key=?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function setMeta(db: D1Database, key: string, value: string) {
  await db
    .prepare(`INSERT OR REPLACE INTO library_meta(key,value) VALUES(?,?)`)
    .bind(key, value)
    .run();
}

async function loadRevision(db: D1Database): Promise<number> {
  const raw = await getMeta(db, "revision");
  const n = raw != null ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

async function bumpRevision(db: D1Database, from: number): Promise<number> {
  const next = nextLibraryRevision(from);
  await setMeta(db, "revision", String(next));
  return next;
}

async function loadLib(db: D1Database) {
  await ensureSchema(db);
  const lists: any = { playlist: [], favorites: [], history: [] };
  for (const lt of Object.keys(lists)) {
    const { results } = await db
      .prepare(`SELECT * FROM library_tracks WHERE list_type=? ORDER BY pos ASC LIMIT 2000`)
      .bind(lt)
      .all();
    lists[lt] = (results || []).map((r: any) => ({
      id: /^\d+$/.test(String(r.sid)) ? Number(r.sid) : r.sid,
      name: r.name || "",
      artist: r.artist || "",
      album: r.album || "",
      cover: r.cover || "",
      duration: r.duration || 0,
    }));
  }
  const row = await db
    .prepare(`SELECT value FROM library_meta WHERE key='curIdx'`)
    .first<{ value: string }>();
  let curIdx = row ? parseInt(row.value, 10) : -1;
  if (Number.isNaN(curIdx) || curIdx >= lists.playlist.length) {
    curIdx = lists.playlist.length ? 0 : -1;
  }
  const revision = await loadRevision(db);
  return { ...lists, curIdx, revision };
}

/**
 * Safe list rewrite: upsert first, then delete stale rows.
 * Never DELETE-all before inserts — a mid-flight timeout used to wipe favorites
 * (observed drop ~578 → ~240 ≈ partial batch after wipe).
 */
/**
 * P1-1: history sparse writes (monotonic pos).
 * Returns the sid order the table will report, so the PUT response can echo the
 * stored order instead of whatever the client happened to send.
 */
async function writeHistoryList(
  db: D1Database,
  tracks: any[],
  cap: number
): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT sid, pos FROM library_tracks WHERE list_type=?`)
    .bind("history")
    .all();
  const existing = (results || []).map((r: any) => ({
    sid: String(r.sid),
    pos: Number(r.pos),
  }));
  const plan = planHistoryWrites(existing, tracks, cap);
  const now = Date.now() / 1000;
  const stmts: D1PreparedStatement[] = [];
  for (const u of plan.upserts) {
    const t = u.track;
    stmts.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO library_tracks
           (list_type,sid,pos,name,artist,album,cover,duration,level,br,size,cached,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          "history",
          u.sid,
          u.pos,
          t.name || "",
          t.artist || "",
          t.album || "",
          t.cover || "",
          t.duration || 0,
          t.level || "",
          t.br || 0,
          t.size || 0,
          0,
          now
        )
    );
  }
  for (const sid of plan.deleteSids) {
    stmts.push(
      db.prepare(`DELETE FROM library_tracks WHERE list_type=? AND sid=?`).bind("history", sid)
    );
  }
  for (let i = 0; i < stmts.length; i += 80) {
    await db.batch(stmts.slice(i, i + 80));
  }
  return plan.finalOrder;
}

async function writeList(db: D1Database, listType: string, tracks: any[], cap: number) {
  const seen = new Set<string>();
  let pos = 0;
  const now = Date.now() / 1000;
  const stmts: D1PreparedStatement[] = [];
  const flush = async () => {
    if (!stmts.length) return;
    const chunk = stmts.splice(0, stmts.length);
    for (let i = 0; i < chunk.length; i += 80) {
      await db.batch(chunk.slice(i, i + 80));
    }
  };
  for (const raw of tracks || []) {
    const t = sanitize(raw);
    if (!t) continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    if (pos >= cap) break;
    stmts.push(
      db
        .prepare(
          `INSERT OR REPLACE INTO library_tracks
           (list_type,sid,pos,name,artist,album,cover,duration,level,br,size,cached,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .bind(
          listType,
          k,
          pos,
          t.name,
          t.artist,
          t.album,
          t.cover,
          t.duration,
          t.level,
          t.br,
          t.size,
          0,
          now
        )
    );
    pos++;
    if (stmts.length >= 80) await flush();
  }
  await flush();
  // Drop rows not rewritten in this pass (removed tracks)
  await db
    .prepare(`DELETE FROM library_tracks WHERE list_type=? AND updated_at < ?`)
    .bind(listType, now)
    .run();
}

/** Reorder client tracks to match the stored sid order (drops unknown sids). */
function orderTracksBySids(tracks: any[], sids: string[]): any[] {
  if (!sids.length) return tracks;
  const bySid = new Map<string, any>();
  for (const t of tracks || []) {
    const id = t?.id ?? t?.sid;
    if (id == null || id === "") continue;
    const k = String(id);
    if (!bySid.has(k)) bySid.set(k, t);
  }
  const out: any[] = [];
  for (const sid of sids) {
    const hit = bySid.get(sid);
    if (hit) out.push(hit);
  }
  return out.length ? out : tracks;
}

async function saveLib(
  db: D1Database,
  data: any,
  opts?: { expectedRevision?: number | null; existing?: any; verify?: boolean }
) {
  await ensureSchema(db);
  const serverRev = await loadRevision(db);
  const clientRev =
    opts?.expectedRevision !== undefined
      ? opts.expectedRevision
      : data.revision != null
        ? Number(data.revision)
        : null;
  if (!libraryRevisionOk(serverRev, clientRev)) {
    const current = opts?.existing || (await loadLib(db));
    return { conflict: true as const, data: current };
  }
  // P1-2: reuse caller's snapshot when provided (PUT already loaded once)
  const existing = opts?.existing || (await loadLib(db));
  const pl = data.playlist !== undefined ? data.playlist || [] : existing.playlist;
  const fav = data.favorites !== undefined ? data.favorites || [] : existing.favorites;
  const hi = data.history !== undefined ? data.history || [] : existing.history;
  const curIdx = data.curIdx !== undefined ? data.curIdx : existing.curIdx ?? -1;
  const plChanged = data.playlist !== undefined && !trackListSameIds(pl, existing.playlist);
  const favChanged = data.favorites !== undefined && !trackListSameIds(fav, existing.favorites);
  const hiChanged = data.history !== undefined && !trackListSameIds(hi, existing.history);
  const curChanged = String(curIdx) !== String(existing.curIdx ?? -1);
  if (!plChanged && !favChanged && !hiChanged && !curChanged) {
    return { conflict: false as const, data: existing };
  }
  if (plChanged) await writeList(db, "playlist", pl, 2000);
  if (favChanged) await writeList(db, "favorites", fav, 2000);
  let historyOut = hi;
  if (hiChanged) {
    const order = await writeHistoryList(db, hi, 2000);
    historyOut = orderTracksBySids(hi, order);
  }
  if (curChanged) await setMeta(db, "curIdx", String(curIdx));
  const nextRev = await bumpRevision(db, serverRev);
  if (opts?.verify) {
    return { conflict: false as const, data: await loadLib(db) };
  }
  const out = {
    playlist: pl,
    favorites: fav,
    history: historyOut,
    curIdx,
    revision: nextRev,
  };
  return { conflict: false as const, data: out };
}

async function deleteSid(
  db: D1Database,
  listType: string,
  sid: string,
  expectedRevision?: number | null
) {
  await ensureSchema(db);
  const serverRev = await loadRevision(db);
  if (!libraryRevisionOk(serverRev, expectedRevision)) {
    return { conflict: true as const, data: await loadLib(db) };
  }
  await db
    .prepare(`DELETE FROM library_tracks WHERE list_type=? AND sid=?`)
    .bind(listType, String(sid))
    .run();
  // History uses sparse monotonic pos — do not rewrite 200 rows on one delete.
  if (listType !== "history") {
    const { results } = await db
      .prepare(`SELECT sid FROM library_tracks WHERE list_type=? ORDER BY pos ASC`)
      .bind(listType)
      .all();
    const stmts: D1PreparedStatement[] = [];
    let i = 0;
    for (const r of results || []) {
      stmts.push(
        db
          .prepare(`UPDATE library_tracks SET pos=? WHERE list_type=? AND sid=?`)
          .bind(i++, listType, (r as any).sid)
      );
      if (stmts.length >= 80) {
        await db.batch(stmts.splice(0, stmts.length));
      }
    }
    if (stmts.length) await db.batch(stmts);
  }
  await bumpRevision(db, serverRev);
  return { conflict: false as const, data: await loadLib(db) };
}

function envReadonly(env: Env): boolean {
  return isLibraryReadonly(env.LIBRARY_READONLY);
}

/** In-isolate demo limiter — cuts public-gateway abuse on the free request quota. */
const demoHits = new Map<string, { n: number; t: number }>();

function demoRateLimited(
  c: { env: Env; req: { header: (n: string) => string | undefined } },
  bucket: string,
  limitPerMin: number
): Response | null {
  if (!envReadonly(c.env)) return null;
  const ip = (c.req.header("CF-Connecting-IP") || c.req.header("cf-connecting-ip") || "x").trim();
  const window = Math.floor(Date.now() / 60_000);
  const key = `${ip}:${bucket}:${window}`;
  const prev = demoHits.get(key);
  const n = (prev?.n || 0) + 1;
  demoHits.set(key, { n, t: Date.now() });
  if (demoHits.size > 4000) {
    const cutoff = Date.now() - 120_000;
    for (const [k, v] of demoHits) {
      if (v.t < cutoff) demoHits.delete(k);
    }
  }
  if (n > limitPerMin) {
    return new Response(JSON.stringify({ ok: false, error: "rate limited" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Retry-After": "60",
      },
    });
  }
  return null;
}

function clampSearchLimit(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 20;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

/** JSON 403 for demo write / export / import. */
function readOnlyForbidden(message = "read-only demo"): Response {
  return new Response(
    JSON.stringify({ ok: false, error: message, readOnly: true }),
    { status: 403, headers: { "Content-Type": "application/json;charset=utf-8" } }
  );
}

function withKey(env: Env) {
  // Patch process-less env for chksz via opts
  return env.CHKSZ_APIKEY || "";
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => {
  const readOnly = envReadonly(c.env);
  return c.json({
    ok: true,
    service: "music",
    provider: "chksz",
    runtime: "cloudflare-workers",
    // .top is free (no key). Keys are only for .com backup.
    has_apikey: Boolean(c.env.CHKSZ_APIKEY || c.env.CHKSZ_FALLBACK_APIKEYS),
    has_fallback_keys: Boolean(c.env.CHKSZ_FALLBACK_APIKEYS || c.env.CHKSZ_APIKEY),
    primary_needs_key: false,
    has_d1: Boolean(c.env.MUSIC_DU_DB),
    // Private site: Cloudflare Access. Demo: open read, writes 403.
    library_auth: false,
    readOnly,
    project: readOnly ? "music-du-demo" : "music-du",
    /** Free-tier contract for operators */
    policy: {
      paid_services: false,
      audio_edge_cache: false,
      audio_byte_proxy: false,
      audio_play: "remote-url-direct",
      cover_chart_cache: "workers-cache-api-free",
      library: c.env.MUSIC_DU_DB
        ? readOnly
          ? "music-du-demo (d1 free, read-only demo)"
          : "music-du-library (d1 free)"
        : "browser-localStorage",
      worker_name: readOnly ? "music-du-demo" : "music-du",
      d1_name: readOnly ? "music-du-demo" : "music-du-library",
      library_readonly: readOnly,
      export_import: readOnly ? false : true,
    },
    version: 2,
  });
});

app.get("/api/search", async (c) => {
  const denied = demoRateLimited(c, "search", 20);
  if (denied) return denied;
  const q = c.req.query("q") || c.req.query("keyword") || "";
  try {
    const songs = await chksz.search(q, clampSearchLimit(c.req.query("limit")), {
      apikey: withKey(c.env),
    });
    return c.json({ ok: true, data: songs });
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 500;
    console.error(e);
    return c.json({ ok: false, error: "upstream error" }, status as any);
  }
});

app.get("/api/charts", (c) =>
  c.json({
    ok: true,
    data: {
      platforms: listChartPlatforms(),
      boards: listChartBoards(),
      defaultBoard: "soar",
    },
  })
);

app.get("/api/charts/:platform", async (c) => {
  const platform = c.req.param("platform");
  if (!isChartPlatform(platform)) {
    return c.json({ ok: false, error: "unknown platform" }, 400);
  }
  // Q-1: accept force or refresh (align with Node app.ts)
  // Demo: ignore force — a public ?force=1 would rematch and burn the free quota.
  const force =
    !envReadonly(c.env) &&
    (c.req.query("force") === "1" ||
      c.req.query("refresh") === "1" ||
      c.req.query("force") === "true");
  const board = normalizeBoard(
    platform,
    c.req.query("board") || c.req.query("type") || "soar"
  );
  // Free CF Cache API — skip when force refresh
  if (!force) {
    const hit = await edgeMatch(c.req.url);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Chart-Cache", "CF-HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }
  try {
    const data = await getChart(platform as ChartPlatformId, {
      apikey: withKey(c.env),
      limit: Math.min(40, Math.max(10, Number(c.req.query("limit") || 40) || 40)),
      force,
      board,
    });
    const body = JSON.stringify({ ok: true, data });
    const headers = withCacheHeaders(
      { "Content-Type": "application/json; charset=utf-8", "X-Chart-Cache": "MISS" },
      "chart",
      { maxAgeSec: chartEdgeMaxAgeSec(board) }
    );
    const res = new Response(body, { status: 200, headers });
    if (!force) {
      edgePut(c.req.url, res, c.executionCtx);
    }
    return res;
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 502;
    console.error(e);
    return c.json({ ok: false, error: "upstream error" }, status as any);
  }
});

/** Top N ladder levels that actually return a URL for this track. */
app.get("/api/song/:sid/qualities", async (c) => {
  const denied = demoRateLimited(c, "qualities", 8);
  if (denied) return denied;
  const sid = c.req.param("sid");
  const limit = Math.min(5, Math.max(1, Number(c.req.query("limit") || 3)));
  const force = c.req.query("force") === "1" && !envReadonly(c.env);
  const cacheUrl = new URL(c.req.url);
  cacheUrl.searchParams.delete("force");
  if (!force) {
    const hit = await edgeMatch(cacheUrl.toString());
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Qualities-Cache", "CF-HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }
  try {
    // D1: if we already have enough fresh levels, skip upstream probe
    const db = c.env.MUSIC_DU_DB;
    if (db && !force) {
      await ensureResolveCacheSchema(db);
      const cached = await listResolveCache(db, sid, 12);
      if (cached.length >= Math.min(2, limit)) {
        const ladder = qualityLadder();
        const qualities = [...cached]
          .filter((r) => r.level && r.level !== "default")
          .map((r) => ({
            level: r.level,
            br: r.br,
            size: r.size,
            url: r.url,
            name: r.name,
            artist: r.artist,
            cover: r.cover,
          }))
          .sort((a, b) => {
            const ia = ladder.indexOf(a.level);
            const ib = ladder.indexOf(b.level);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          })
          .slice(0, limit);
        if (qualities.length >= Math.min(2, limit)) {
          const body = JSON.stringify({
            ok: true,
            data: { id: sid, qualities, cache: "d1" },
          });
          const headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=60, s-maxage=180",
            "X-Qualities-Cache": "D1-HIT",
          };
          const res = new Response(body, { status: 200, headers });
          edgePut(cacheUrl.toString(), res, c.executionCtx);
          return res;
        }
      }
    }

    // Demo: never walk the quality ladder (3–8 upstream calls per click).
    if (envReadonly(c.env)) {
      return c.json({ ok: true, data: { id: sid, qualities: [] } });
    }
    const qualities = await chksz.probeTopQualities(sid, limit, {
      apikey: withKey(c.env),
    });
    // Persist each tier into D1 for instant later switches / multi-device
    if (db && qualities.length) {
      await ensureResolveCacheSchema(db);
      await Promise.all(
        qualities.map((q) =>
          putResolveCache(db, {
            sid,
            level: q.level,
            url: q.url,
            br: q.br,
            size: q.size,
            name: q.name,
            artist: q.artist,
            cover: q.cover,
            source: "remote",
          })
        )
      );
      // Opportunistic prune (ignore errors)
      c.executionCtx?.waitUntil?.(pruneResolveCache(db));
    }
    const body = JSON.stringify({ ok: true, data: { id: sid, qualities } });
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
      "X-Qualities-Cache": "MISS",
    };
    const res = new Response(body, { status: 200, headers });
    if (qualities.length) edgePut(cacheUrl.toString(), res, c.executionCtx);
    return res;
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 500;
    console.error(e);
    return c.json({ ok: false, error: "upstream error" }, status as any);
  }
});

app.get("/api/song/:sid", async (c) => {
  const denied = demoRateLimited(c, "song", 30);
  if (denied) return denied;
  const sid = c.req.param("sid");
  const level = c.req.query("level") || "";
  const force = c.req.query("force") === "1" && !envReadonly(c.env);
  // Cache API: JSON metadata only (never audio bytes). Short TTL — signed URLs die.
  const cacheUrl = new URL(c.req.url);
  cacheUrl.searchParams.set("level", level || "default");
  cacheUrl.searchParams.delete("force");
  if (!force) {
    const hit = await edgeMatch(cacheUrl.toString());
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Song-Cache", "CF-HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }

  const db = c.env.MUSIC_DU_DB;
  // D1 short-TTL resolve cache (shared across devices / hard refresh)
  if (db && !force) {
    try {
      await ensureResolveCacheSchema(db);
      const d1hit = await getResolveCache(db, sid, level || "default");
      if (d1hit?.url) {
        const stream = `/api/stream/${sid}${level ? `?level=${encodeURIComponent(level)}` : ""}`;
        const data = {
          id: sid,
          url: d1hit.url,
          level: d1hit.level === "default" ? level || d1hit.level : d1hit.level,
          br: d1hit.br,
          size: d1hit.size,
          name: d1hit.name,
          artist: d1hit.artist,
          cover: d1hit.cover,
          source: d1hit.source || "remote",
          stream,
          play: chooseAudioSrc({ url: d1hit.url }, stream),
          cache: "d1",
        };
        const body = JSON.stringify({ ok: true, data });
        const headers = {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=300",
          "X-Song-Cache": "D1-HIT",
        };
        const res = new Response(body, { status: 200, headers });
        edgePut(cacheUrl.toString(), res, c.executionCtx);
        return res;
      }
    } catch {
      /* fall through to upstream */
    }
  }

  try {
    const src = await resolvePlay(sid, level || c.req.query("level"), {
      apikey: withKey(c.env),
    });
    if (src.source === "none" && !src.meta) return c.json({ ok: false, error: "no url" }, 404);
    const stream = `/api/stream/${sid}${level ? `?level=${encodeURIComponent(level)}` : ""}`;
    const remoteUrl = src.source === "remote" ? src.url : "";
    const data = {
      id: sid,
      url: remoteUrl,
      level: src.level,
      br: src.br,
      size: src.size,
      name: src.name,
      artist: src.artist,
      cover: src.cover,
      source: src.source,
      stream,
      play: chooseAudioSrc({ url: remoteUrl }, stream),
    };
    // Write D1 for next request / multi-device
    if (db && remoteUrl) {
      c.executionCtx?.waitUntil?.(
        (async () => {
          try {
            await ensureResolveCacheSchema(db);
            // Only cache under the *actual* delivered level — never poison
            // requested keys (e.g. jymaster) with a fallthrough standard URL.
            const actualLevel = src.level || level || "default";
            const row = {
              sid,
              url: remoteUrl,
              br: src.br,
              size: src.size,
              name: src.name,
              artist: src.artist,
              cover: src.cover,
              source: src.source,
            };
            await putResolveCache(db, { ...row, level: actualLevel });
            // Alias requested intent (e.g. sky) so the next play hits D1
            // instead of walking the ladder again.
            if (level && level !== actualLevel) {
              await putResolveCache(db, { ...row, level });
            }
            await pruneResolveCache(db);
          } catch {
            /* */
          }
        })()
      );
    }
    const body = JSON.stringify({ ok: true, data });
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      // Keep edge ≤ D1 resolve TTL (~18m); signed CDN URLs die sooner
      "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=120",
      "X-Song-Cache": "MISS",
    };
    const res = new Response(body, { status: 200, headers });
    if (!force && remoteUrl) {
      edgePut(cacheUrl.toString(), res, c.executionCtx);
    }
    return res;
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 500;
    console.error(e);
    return c.json({ ok: false, error: "upstream error" }, status as any);
  }
});

app.get("/api/lyric/:sid", async (c) => {
  const denied = demoRateLimited(c, "lyric", 20);
  if (denied) return denied;
  const force = c.req.query("force") === "1" && !envReadonly(c.env);
  if (!force) {
    const hit = await edgeMatch(c.req.url);
    if (hit) {
      const headers = new Headers(hit.headers);
      headers.set("X-Lyric-Cache", "CF-HIT");
      return new Response(hit.body, { status: hit.status, headers });
    }
  }
  try {
    const d = await resolveLyrics(c.req.param("sid"), {
      apikey: withKey(c.env),
      name: c.req.query("name") || c.req.query("title") || "",
      artist: c.req.query("artist") || "",
      duration: Number(c.req.query("duration") || 0) || 0,
      force,
    });
    const body = JSON.stringify({ ok: true, data: d });
    const headers = withCacheHeaders(
      {
        "Content-Type": "application/json; charset=utf-8",
        "X-Lyric-Cache": "MISS",
      },
      "lyric"
    );
    const res = new Response(body, { status: 200, headers });
    if (!force && (d?.lrc || d?.tlrc)) {
      edgePut(c.req.url, res, c.executionCtx);
    }
    return res;
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 500;
    console.error(e);
    return c.json({ ok: false, error: "upstream error" }, status as any);
  }
});

/**
 * Stream fallback: 302 to remote CDN only.
 * NEVER proxy audio body through the Worker (bandwidth/CPU).
 * NEVER put audio into Cache API.
 */
app.get("/api/stream/:sid", async (c) => {
  const denied = demoRateLimited(c, "stream", 30);
  if (denied) return denied;
  try {
    const sid = c.req.param("sid");
    const level = c.req.query("level") || "";
    const db = c.env.MUSIC_DU_DB;
    // Prefer fresh D1 URL before hitting upstream again
    if (db) {
      try {
        await ensureResolveCacheSchema(db);
        const hit = await getResolveCache(db, sid, level || "default");
        if (hit?.url && chksz.isRemoteUrl(hit.url)) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: hit.url,
              "Cache-Control": "private, no-store",
              "X-Play-Source": "redirect-d1",
              "X-Audio-Cache": "disabled",
            },
          });
        }
      } catch {
        /* */
      }
    }
    const raw = await chksz.fetchMusic(sid, level, {
      apikey: withKey(c.env),
    });
    const audioUrl = raw?.url || "";
    if (!chksz.isRemoteUrl(audioUrl)) {
      return c.json({ ok: false, error: "no remote url" }, 404);
    }
    if (db) {
      c.executionCtx?.waitUntil?.(
        putResolveCache(db, {
          sid,
          level: raw.level || level || "default",
          url: audioUrl,
          br: Number(raw.br || 0),
          size: Number(raw.size || 0),
          name: String(raw.name || ""),
          artist: String(raw.artist || ""),
          cover: chksz.tryHttps(String(raw.picUrl || raw.cover || "")),
          source: "remote",
        })
      );
    }
    // Browser follows redirect and plays from origin CDN — free for CF egress
    return new Response(null, {
      status: 302,
      headers: {
        Location: audioUrl,
        "Cache-Control": "private, no-store",
        "X-Play-Source": "redirect-remote",
        "X-Audio-Cache": "disabled",
      },
    });
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 502;
    console.error(e);
    return c.json({ ok: false, error: "upstream error" }, status as any);
  }
});

app.get("/api/cover-proxy", async (c) => {
  const url = c.req.query("url") || "";
  if (!url.startsWith("http")) return coverErrorResponse(400);
  if (!isAllowedCoverUrl(url)) return coverErrorResponse(403);

  // Free: Cloudflare Cache API (no R2/KV). Only successful image bodies are stored.
  const cached = await edgeMatch(c.req.url);
  if (cached && cached.ok) {
    const headers = new Headers(cached.headers);
    headers.set("X-Cover-Cache", "CF-HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const hit = await fetchCoverUpstream(url, { timeoutMs: 10000 });
    if (!hit) return coverErrorResponse(404);
    const headers = withCacheHeaders(
      {
        "Content-Type": hit.contentType,
        "X-Cover-Cache": "MISS",
        "X-Cover-Upstream": hit.finalUrl !== url ? "mirror" : "direct",
      },
      "cover"
    );
    const res = new Response(hit.body, { status: 200, headers });
    edgePut(c.req.url, res, c.executionCtx);
    return res;
  } catch {
    return coverErrorResponse(502);
  }
});

app.get("/api/library", async (c) => {
  // No D1 → 503 so client falls back to localStorage (free, no paid store)
  if (!c.env.MUSIC_DU_DB) {
    return c.json(
      {
        ok: false,
        error: "D1 not configured — browser localStorage only (free)",
        localOnly: true,
        readOnly: envReadonly(c.env),
      },
      503
    );
  }
  const lib = await loadLib(c.env.MUSIC_DU_DB);
  const readOnly = envReadonly(c.env);
  // C2: demo / readonly public GET never exposes history or curIdx
  const data = readOnly ? publicReadonlyLibraryData(lib) : lib;
  return c.json({
    ok: true,
    data,
    readOnly,
  });
});

/**
 * Short URL: open /favs or /export to download favorites JSON.
 * Private: Cloudflare Access at the edge (see docs/ACCESS.md).
 * Demo (LIBRARY_READONLY): permanently disabled.
 */
async function favoritesExportResponse(c: {
  env: Env;
  req: { header: (n: string) => string | undefined; url: string };
}) {
  if (envReadonly(c.env)) {
    return readOnlyForbidden("export disabled on demo");
  }
  if (!c.env.MUSIC_DU_DB) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "D1 not configured — browser localStorage only (free)",
        localOnly: true,
      }),
      { status: 503, headers: { "Content-Type": "application/json;charset=utf-8" } }
    );
  }
  const lib = await loadLib(c.env.MUSIC_DU_DB);
  const favorites = (lib.favorites || []).map((t: any) => ({
    id: t.id,
    name: t.name || "",
    artist: t.artist || "",
    album: t.album || "",
    cover: t.cover || "",
    duration: Number(t.duration || 0) || 0,
  }));
  const host = (() => {
    try {
      return new URL(c.req.url).host || "localhost";
    } catch {
      return "localhost";
    }
  })();
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = {
    exportedAt: new Date().toISOString(),
    source: host,
    count: favorites.length,
    favorites,
  };
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      "Content-Disposition": `attachment; filename="favorites-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

app.get("/favs", (c) => favoritesExportResponse(c));
app.get("/export", (c) => favoritesExportResponse(c));

function escHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Import page — Access-gated; supports /favs JSON + name lists. */
function favoritesImportHtml(
  msg?: string,
  opts?: { ok?: boolean; failed?: string[]; homeQs?: string }
) {
  const ok = Boolean(opts?.ok);
  const failed = opts?.failed || [];
  const homeHref = opts?.homeQs ? `/?${opts.homeQs}` : "/";
  const failBlock =
    failed.length > 0
      ? `<div class="fail">
          <p class="fail-title">未匹配 ${failed.length} 首（未写入收藏）</p>
          <ul class="fail-list">${failed
            .slice(0, 200)
            .map((x) => `<li>${escHtml(x)}</li>`)
            .join("")}${
            failed.length > 200
              ? `<li>… 另有 ${failed.length - 200} 首未列出</li>`
              : ""
          }</ul>
        </div>`
      : "";
  const notice = msg
    ? `<p class="msg${ok ? " ok" : ""}">${escHtml(msg)}</p>`
    : `<p class="hint">支持：<br/>
      1) <code>/favs</code> 导出的 JSON（按 id 精确合并）<br/>
      2) 文本/CSV：每行 <code>歌名</code> 或 <code>歌名 - 作者</code>（搜索匹配，可能有误差）<br/>
      已有收藏按 <strong>id 去重</strong>，不会重复导入。</p>`;
  const formBlock =
    ok && failed.length
      ? `<p class="links"><a class="btn" href="${escHtml(homeHref)}">打开播放器</a>
         · <a href="/import">继续导入</a> · <a href="/favs">导出 /favs</a></p>`
      : `<form method="post" action="/import" enctype="multipart/form-data">
      <input type="file" name="file" accept="application/json,.json,.txt,.csv,text/plain,text/csv" required />
      <button type="submit">合并导入（自动去重）</button>
    </form>
    <p class="links"><a href="${escHtml(homeHref)}">← 返回播放器</a> · <a href="/favs">导出 /favs</a></p>`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>导入收藏 · Music</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
      background: #0b0b12; color: #f4f4f5; padding: 24px 12px; box-sizing: border-box; }
    .card { width: min(480px, 96vw); padding: 28px 24px; border-radius: 16px;
      background: #18181b; border: 1px solid #27272a; box-shadow: 0 20px 50px #0008; }
    h1 { margin: 0 0 8px; font-size: 1.25rem; }
    .hint, .msg { margin: 0 0 16px; opacity: .7; font-size: .88rem; line-height: 1.5; }
    .msg { color: #fca5a5; opacity: 1; }
    .msg.ok { color: #6ee7b7; }
    code { font-size: .85em; opacity: .9; }
    input[type=file] { width: 100%; margin: 12px 0 16px; }
    button, a.btn { display: inline-block; width: 100%; padding: 12px 16px; border: 0;
      border-radius: 10px; font-weight: 800; cursor: pointer; background: #a78bfa;
      color: #1e1b4b; text-align: center; text-decoration: none; box-sizing: border-box; }
    button:hover, a.btn:hover { filter: brightness(1.06); }
    a { color: #c4b5fd; }
    .links { margin-top: 18px; font-size: .85rem; opacity: .65; }
    .fail { margin: 12px 0 8px; max-height: 40vh; overflow: auto;
      border: 1px solid #3f3f46; border-radius: 10px; padding: 10px 12px; background: #09090b; }
    .fail-title { margin: 0 0 8px; font-size: .85rem; font-weight: 800; color: #fcd34d; }
    .fail-list { margin: 0; padding-left: 1.15rem; font-size: .82rem; line-height: 1.45; opacity: .85; }
    .fail-list li { margin: 2px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>导入收藏</h1>
    ${notice}
    ${failBlock}
    ${formBlock}
  </div>
</body>
</html>`;
}

app.get("/import", (c) => {
  if (envReadonly(c.env)) {
    return c.html(
      favoritesImportHtml("Demo 只读：不允许导入", { ok: false }),
      403
    );
  }
  return c.html(favoritesImportHtml());
});

/** Cap name-match rows per request (free-tier rate limits). */
const IMPORT_NAME_MATCH_CAP = 15;

app.post("/import", async (c) => {
  if (envReadonly(c.env)) {
    return c.html(
      favoritesImportHtml("Demo 只读：不允许导入", { ok: false }),
      403
    );
  }
  if (!c.env.MUSIC_DU_DB) {
    return c.html(favoritesImportHtml("D1 未配置，无法导入"), 503);
  }
  try {
    injectEnv(c.env);
    const ct = c.req.header("content-type") || "";
    let text = "";
    if (ct.includes("multipart/form-data")) {
      const body = await c.req.parseBody();
      const file = body.file;
      if (file && typeof file === "object" && "text" in file) {
        text = await (file as File).text();
      } else if (typeof file === "string") {
        text = file;
      }
    } else if (ct.includes("application/json")) {
      text = JSON.stringify(await c.req.json().catch(() => null));
    } else {
      text = await c.req.text();
    }
    if (!text?.trim()) {
      return c.html(favoritesImportHtml("未收到文件内容"), 400);
    }

    const parsed = parseImportPayload(text);
    if (!parsed.ok) {
      return c.html(favoritesImportHtml(parsed.error), 400);
    }

    const existing = await loadLib(c.env.MUSIC_DU_DB);
    const haveIds = new Set(
      (existing.favorites || []).map((t: any) => String(t.id))
    );

    const resolved: FavsExportTrack[] = [];
    const failed: string[] = [];
    let skippedDup = 0;
    let nameMatched = 0;

    // Phase 1: exact ids
    for (const row of parsed.rows) {
      if (row.kind !== "exact") continue;
      const k = String(row.id);
      if (haveIds.has(k) || resolved.some((t) => String(t.id) === k)) {
        skippedDup++;
        continue;
      }
      resolved.push({
        id: row.id,
        name: row.name,
        artist: row.artist,
        album: row.album,
        cover: row.cover,
        duration: row.duration,
      });
      haveIds.add(k);
    }

    // Phase 2: name / name+artist → search (slow; capped)
    const nameRows = parsed.rows.filter((r) => r.kind === "name").slice(0, IMPORT_NAME_MATCH_CAP);
    const overCap = parsed.rows.filter((r) => r.kind === "name").length - nameRows.length;
    for (const row of nameRows) {
      if (row.kind !== "name") continue;
      try {
        let hits: Track[] = await chksz.search(row.query, 8, {
          apikey: withKey(c.env),
        });
        if (!hits.length && row.artist) {
          hits = await chksz.search(row.name, 8, { apikey: withKey(c.env) });
        }
        let best: Track | null = null;
        let bestScore = -1;
        for (const h of hits) {
          const sc = scoreNameMatch(row.name, row.artist, h.name, h.artist || "");
          if (sc > bestScore) {
            bestScore = sc;
            best = h;
          }
        }
        const need = minScoreForMatch(Boolean(row.artist));
        if (!best || bestScore < need) {
          failed.push(row.artist ? `${row.name} - ${row.artist}` : row.name);
          continue;
        }
        const k = String(best.id);
        if (haveIds.has(k)) {
          skippedDup++;
          continue;
        }
        resolved.push({
          id: best.id,
          name: best.name || row.name,
          artist: best.artist || row.artist,
          album: best.album || "",
          cover: best.cover || "",
          duration: Number(best.duration || 0) || 0,
        });
        haveIds.add(k);
        nameMatched++;
        // gentle pacing for free upstream
        await new Promise((r) => setTimeout(r, 120));
      } catch {
        failed.push(row.artist ? `${row.name} - ${row.artist}` : row.name);
      }
    }

    const onlyNew = filterNewById(existing.favorites || [], resolved);
    let total = (existing.favorites || []).length;
    let added = 0;

    if (onlyNew.length) {
      const fav = mergeTrackList(existing.favorites || [], onlyNew, false, 2000);
      const result = await saveLib(
        c.env.MUSIC_DU_DB,
        {
          playlist: existing.playlist,
          favorites: fav,
          history: existing.history,
          curIdx: existing.curIdx,
          revision: existing.revision,
        },
        { expectedRevision: existing.revision ?? 0 }
      );
      if (result.conflict) {
        return c.html(favoritesImportHtml("库正在被其他端写入，请重试"), 409);
      }
      total = (result.data.favorites || []).length;
      added = onlyNew.length;
    }

    const qs = new URLSearchParams({
      imported: String(added),
      total: String(total),
      skipped: String(skippedDup),
      matched: String(nameMatched),
    });
    if (failed.length) qs.set("failed", String(failed.length));
    if (overCap > 0) qs.set("capped", String(overCap));
    const homeQs = qs.toString();

    // Name-match failures: show full list on import page (URL can't hold long names)
    if (failed.length > 0) {
      const parts = [
        added > 0 ? `新增 ${added} 首` : "无新歌写入",
        `收藏共 ${total}`,
        skippedDup ? `去重 ${skippedDup}` : "",
        nameMatched ? `名匹配成功 ${nameMatched}` : "",
        `未匹配 ${failed.length}`,
        overCap > 0 ? `另有 ${overCap} 行超出名匹配上限未处理` : "",
      ].filter(Boolean);
      return c.html(
        favoritesImportHtml(parts.join(" · "), {
          ok: true,
          failed,
          homeQs,
        })
      );
    }

    // Clean success / all-deduped → jump to player
    return c.redirect(`/?${homeQs}`, 303);
  } catch (e: any) {
    return c.html(
      favoritesImportHtml(`导入失败：${e?.message || String(e)}`),
      400
    );
  }
});

app.put("/api/library", async (c) => {
  if (envReadonly(c.env)) return readOnlyForbidden();
  if (!c.env.MUSIC_DU_DB) {
    return c.json(
      { ok: false, error: "D1 not configured — browser localStorage only (free)", localOnly: true },
      503
    );
  }
  const body = await c.req.json().catch(() => ({}));
  const existing = await loadLib(c.env.MUSIC_DU_DB);
  const clientRev =
    body.revision != null && body.revision !== ""
      ? Number(body.revision)
      : null;
  // Check revision before merge work so client can re-fetch cleanly
  if (!libraryRevisionOk(existing.revision ?? 0, clientRev)) {
    return c.json(
      {
        ok: false,
        error: "library conflict — reload and retry",
        conflict: true,
        data: existing,
      },
      409
    );
  }
  const forcePl = Boolean(body.forceClearPlaylist);
  const forceFav = Boolean(body.forceClearFavorites);
  const forceHi = Boolean(body.forceClearHistory);
  const pl = mergeTrackList(existing.playlist, body.playlist, forcePl, 2000);
  const fav = mergeTrackList(existing.favorites, body.favorites, forceFav, 2000);
  let hi = existing.history;
  if (forceHi) hi = body.history || [];
  else if (body.history?.length) {
    const seen = new Set<string>();
    hi = [];
    for (const t of [...body.history, ...existing.history]) {
      const k = String(t.id ?? t.sid ?? "");
      if (!k || seen.has(k)) continue;
      seen.add(k);
      hi.push(t);
      if (hi.length >= 2000) break;
    }
  }
  const verify =
    new URL(c.req.url).searchParams.get("verify") === "1" ||
    new URL(c.req.url).searchParams.get("verify") === "true";
  const result = await saveLib(
    c.env.MUSIC_DU_DB,
    {
      playlist: pl,
      favorites: fav,
      history: hi,
      curIdx: body.curIdx ?? existing.curIdx,
      revision: clientRev,
    },
    { expectedRevision: clientRev, existing, verify }
  );
  if (result.conflict) {
    return c.json(
      {
        ok: false,
        error: "library conflict — reload and retry",
        conflict: true,
        data: result.data,
      },
      409
    );
  }
  return c.json({ ok: true, data: result.data });
});

app.delete("/api/library/:listType/:sid", async (c) => {
  if (envReadonly(c.env)) return readOnlyForbidden();
  if (!c.env.MUSIC_DU_DB) {
    return c.json(
      { ok: false, error: "D1 not configured — browser localStorage only (free)", localOnly: true },
      503
    );
  }
  const listType = c.req.param("listType");
  if (!["playlist", "favorites", "history"].includes(listType)) {
    return c.json({ ok: false, error: "bad list" }, 400);
  }
  const revRaw = c.req.query("revision");
  const clientRev =
    revRaw != null && revRaw !== "" ? Number(revRaw) : null;
  const result = await deleteSid(
    c.env.MUSIC_DU_DB,
    listType,
    c.req.param("sid"),
    clientRev
  );
  if (result.conflict) {
    return c.json(
      {
        ok: false,
        error: "library conflict — reload and retry",
        conflict: true,
        data: result.data,
      },
      409
    );
  }
  return c.json({ ok: true, data: result.data });
});

app.all("*", async (c) => {
  if (c.env.ASSETS) {
    const url = new URL(c.req.url);
    if (url.pathname === "/" || url.pathname === "") {
      const html = await c.env.ASSETS.fetch(new URL("/index.html", c.req.url));
      // SPA shell: revalidate so deploys pick up new asset hashes
      const headers = new Headers(html.headers);
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
      return new Response(html.body, { status: html.status, headers });
    }
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (asset.status !== 404) {
      // Hashed /assets/* — long cache is fine (Vite content hash)
      if (url.pathname.startsWith("/assets/")) {
        const headers = new Headers(asset.headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(asset.body, { status: asset.status, headers });
      }
      return asset;
    }
    const html = await c.env.ASSETS.fetch(new URL("/index.html", c.req.url));
    const headers = new Headers(html.headers);
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(html.body, { status: html.status, headers });
  }
  return c.json({ ok: false, error: "not found" }, 404);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    injectEnv(env);
    return app.fetch(request, env, ctx);
  },
};

/** Test / tooling: Hono app without CF inject (pass env as fetch 2nd arg). */
export { app as workerApp };
export type { Env as WorkerEnv };
