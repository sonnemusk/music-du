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
  getChart,
  isChartPlatform,
  listChartBoards,
  listChartPlatforms,
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
  ensureResolveCacheSchema,
  getResolveCache,
  listResolveCache,
  pruneResolveCache,
  putResolveCache,
} from "./resolve-cache.js";

export type Env = {
  CHKSZ_APIKEY?: string;
  CHKSZ_API_BASE?: string;
  ASSETS: Fetcher;
  /** Free D1 library — dashboard name: music-du-library (binding MUSIC_DU_DB). */
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
  } catch {
    /* */
  }
}

// Minimal D1 library ops (inline to avoid node:sqlite)
async function ensureSchema(db: D1Database) {
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
  return { ...lists, curIdx };
}

async function writeList(db: D1Database, listType: string, tracks: any[], cap: number) {
  await db.prepare(`DELETE FROM library_tracks WHERE list_type=?`).bind(listType).run();
  const seen = new Set<string>();
  let pos = 0;
  const now = Date.now() / 1000;
  for (const raw of tracks || []) {
    const t = sanitize(raw);
    if (!t) continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    if (pos >= cap) break;
    await db
      .prepare(
        `INSERT INTO library_tracks
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
      .run();
    pos++;
  }
}

async function saveLib(db: D1Database, data: any) {
  await ensureSchema(db);
  await writeList(db, "playlist", data.playlist || [], 2000);
  await writeList(db, "favorites", data.favorites || [], 2000);
  await writeList(db, "history", data.history || [], 2000);
  await db
    .prepare(`INSERT OR REPLACE INTO library_meta(key,value) VALUES('curIdx',?)`)
    .bind(String(data.curIdx ?? -1))
    .run();
  return loadLib(db);
}

async function deleteSid(db: D1Database, listType: string, sid: string) {
  await ensureSchema(db);
  await db
    .prepare(`DELETE FROM library_tracks WHERE list_type=? AND sid=?`)
    .bind(listType, String(sid))
    .run();
  const { results } = await db
    .prepare(`SELECT sid FROM library_tracks WHERE list_type=? ORDER BY pos ASC`)
    .bind(listType)
    .all();
  let i = 0;
  for (const r of results || []) {
    await db
      .prepare(`UPDATE library_tracks SET pos=? WHERE list_type=? AND sid=?`)
      .bind(i++, listType, (r as any).sid)
      .run();
  }
  return loadLib(db);
}

function withKey(env: Env) {
  // Patch process-less env for chksz via opts
  return env.CHKSZ_APIKEY || "";
}

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "music",
    provider: "chksz",
    runtime: "cloudflare-workers",
    has_apikey: Boolean(c.env.CHKSZ_APIKEY),
    has_d1: Boolean(c.env.MUSIC_DU_DB),
    project: "music-du",
    /** Free-tier contract for operators */
    policy: {
      paid_services: false,
      audio_edge_cache: false,
      audio_byte_proxy: false,
      audio_play: "remote-url-direct",
      cover_chart_cache: "workers-cache-api-free",
      library: c.env.MUSIC_DU_DB ? "music-du-library (d1 free)" : "browser-localStorage",
      worker_name: "music-du",
      d1_name: "music-du-library",
    },
    version: 2,
  })
);

app.get("/api/search", async (c) => {
  const q = c.req.query("q") || c.req.query("keyword") || "";
  try {
    const songs = await chksz.search(q, Number(c.req.query("limit") || 30), {
      apikey: withKey(c.env),
    });
    return c.json({ ok: true, data: songs });
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 500;
    return c.json({ ok: false, error: e?.message || String(e) }, status as any);
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
  const force = c.req.query("force") === "1";
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
      limit: Number(c.req.query("limit") || 40) || 40,
      force,
      board: c.req.query("board") || c.req.query("type") || "soar",
    });
    const body = JSON.stringify({ ok: true, data });
    const headers = withCacheHeaders(
      { "Content-Type": "application/json; charset=utf-8", "X-Chart-Cache": "MISS" },
      "chart"
    );
    const res = new Response(body, { status: 200, headers });
    if (!force) {
      edgePut(c.req.url, res, c.executionCtx);
    }
    return res;
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 502;
    return c.json({ ok: false, error: e?.message || String(e) }, status as any);
  }
});

/** Top N ladder levels that actually return a URL for this track. */
app.get("/api/song/:sid/qualities", async (c) => {
  const sid = c.req.param("sid");
  const limit = Math.min(5, Math.max(1, Number(c.req.query("limit") || 3)));
  const force = c.req.query("force") === "1";
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
          .map((r) => ({
            level: r.level === "default" ? "jymaster" : r.level,
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

    const qualities = await chksz.probeTopQualities(sid, limit, {
      apikey: withKey(c.env),
    });
    // Persist each tier into D1 for instant later switches / multi-device
    if (db && qualities.length) {
      await ensureResolveCacheSchema(db);
      for (const q of qualities) {
        await putResolveCache(db, {
          sid,
          level: q.level,
          url: q.url,
          br: q.br,
          size: q.size,
          name: q.name,
          artist: q.artist,
          cover: q.cover,
          source: "remote",
        });
      }
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
    return c.json({ ok: false, error: e?.message || String(e) }, status as any);
  }
});

app.get("/api/song/:sid", async (c) => {
  const sid = c.req.param("sid");
  const level = c.req.query("level") || "";
  const force = c.req.query("force") === "1";
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
            await putResolveCache(db, {
              sid,
              level: src.level || level || "default",
              url: remoteUrl,
              br: src.br,
              size: src.size,
              name: src.name,
              artist: src.artist,
              cover: src.cover,
              source: src.source,
            });
            // Also key under requested level so ?level=jymaster hits D1 next time
            if (level && level !== src.level) {
              await putResolveCache(db, {
                sid,
                level,
                url: remoteUrl,
                br: src.br,
                size: src.size,
                name: src.name,
                artist: src.artist,
                cover: src.cover,
                source: src.source,
              });
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
      "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=300",
      "X-Song-Cache": "MISS",
    };
    const res = new Response(body, { status: 200, headers });
    if (!force && remoteUrl) {
      edgePut(cacheUrl.toString(), res, c.executionCtx);
    }
    return res;
  } catch (e: any) {
    const status = e instanceof chksz.ChkszError ? e.status : 500;
    return c.json({ ok: false, error: e?.message || String(e) }, status as any);
  }
});

app.get("/api/lyric/:sid", async (c) => {
  const force = c.req.query("force") === "1";
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
    return c.json({ ok: false, error: e?.message || String(e) }, status as any);
  }
});

/**
 * Stream fallback: 302 to remote CDN only.
 * NEVER proxy audio body through the Worker (bandwidth/CPU).
 * NEVER put audio into Cache API.
 */
app.get("/api/stream/:sid", async (c) => {
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
    return c.json({ ok: false, error: e?.message || String(e) }, status as any);
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
      },
      503
    );
  }
  return c.json({ ok: true, data: await loadLib(c.env.MUSIC_DU_DB) });
});

/**
 * Merge library lists without accidental wipe.
 * - forceClear*: client explicitly cleared → take incoming (may be empty)
 * - else: incoming order first, then keep server-only rows (removals use DELETE)
 * Prevents a thin client state (e.g. 1 favorite) from clobbering D1 (22 favorites).
 */
function mergeTrackList(
  existing: any[],
  incoming: any[] | undefined,
  forceClear: boolean,
  cap: number
): any[] {
  if (forceClear) {
    const out: any[] = [];
    const seen = new Set<string>();
    for (const t of incoming || []) {
      const id = t?.id ?? t?.sid;
      if (id == null || id === "") continue;
      const k = String(id);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...t, id: /^\d+$/.test(k) ? Number(k) : id });
      if (out.length >= cap) break;
    }
    return out;
  }
  if (!incoming?.length) return existing || [];
  const out: any[] = [];
  const seen = new Set<string>();
  for (const t of incoming) {
    const id = t?.id ?? t?.sid;
    if (id == null || id === "") continue;
    const k = String(id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ ...t, id: /^\d+$/.test(k) ? Number(k) : id });
    if (out.length >= cap) break;
  }
  for (const t of existing || []) {
    if (out.length >= cap) break;
    const id = t?.id ?? t?.sid;
    if (id == null || id === "") continue;
    const k = String(id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

app.put("/api/library", async (c) => {
  if (!c.env.MUSIC_DU_DB) {
    return c.json(
      { ok: false, error: "D1 not configured — browser localStorage only (free)", localOnly: true },
      503
    );
  }
  const body = await c.req.json().catch(() => ({}));
  const existing = await loadLib(c.env.MUSIC_DU_DB);
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
  const data = await saveLib(c.env.MUSIC_DU_DB, {
    playlist: pl,
    favorites: fav,
    history: hi,
    curIdx: body.curIdx ?? existing.curIdx,
  });
  return c.json({ ok: true, data });
});

app.delete("/api/library/:listType/:sid", async (c) => {
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
  const data = await deleteSid(c.env.MUSIC_DU_DB, listType, c.req.param("sid"));
  return c.json({ ok: true, data });
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
