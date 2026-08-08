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
import * as chksz from "./chksz.js";
import { edgeMatch, edgePut, withCacheHeaders } from "./edge-cache.js";
import { resolveLyrics } from "./lyrics.js";
import { chooseAudioSrc, resolvePlay } from "./play.js";

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
      .prepare(`SELECT * FROM library_tracks WHERE list_type=? ORDER BY pos ASC LIMIT 500`)
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
  await writeList(db, "playlist", data.playlist || [], 500);
  await writeList(db, "favorites", data.favorites || [], 500);
  await writeList(db, "history", data.history || [], 300);
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
  try {
    const src = await resolvePlay(sid, level || c.req.query("level"), {
      apikey: withKey(c.env),
    });
    if (src.source === "none" && !src.meta) return c.json({ ok: false, error: "no url" }, 404);
    const stream = `/api/stream/${sid}`;
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
    const body = JSON.stringify({ ok: true, data });
    // ~10 min metadata at edge — browser still has its own durable resolve cache
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=300",
      "X-Song-Cache": "MISS",
    };
    const res = new Response(body, { status: 200, headers });
    if (!force && remoteUrl) {
      // Only edge-cache successful resolves that have a playable remote URL
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
    const raw = await chksz.fetchMusic(c.req.param("sid"), c.req.query("level"), {
      apikey: withKey(c.env),
    });
    const audioUrl = raw?.url || "";
    if (!chksz.isRemoteUrl(audioUrl)) {
      return c.json({ ok: false, error: "no remote url" }, 404);
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
  if (!url.startsWith("http")) return c.body(null, 400);

  // Free: Cloudflare Cache API (no R2/KV)
  const cached = await edgeMatch(c.req.url);
  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("X-Cover-Cache", "CF-HIT");
    return new Response(cached.body, { status: cached.status, headers });
  }

  try {
    const up = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://music.163.com/" },
    });
    if (!up.ok) return c.body(null, 404);
    const buf = await up.arrayBuffer();
    const headers = withCacheHeaders(
      {
        "Content-Type": up.headers.get("Content-Type") || "image/jpeg",
        "X-Cover-Cache": "MISS",
      },
      "cover"
    );
    const res = new Response(buf, { status: 200, headers });
    edgePut(c.req.url, res, c.executionCtx);
    return res;
  } catch {
    return c.body(null, 404);
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
  const pl =
    forcePl || (body.playlist && body.playlist.length) ? body.playlist : existing.playlist;
  const fav =
    forceFav || (body.favorites && body.favorites.length)
      ? body.favorites
      : existing.favorites;
  let hi = existing.history;
  if (forceHi) hi = body.history || [];
  else if (body.history?.length) {
    const seen = new Set<string>();
    hi = [];
    for (const t of [...body.history, ...existing.history]) {
      const k = String(t.id);
      if (seen.has(k)) continue;
      seen.add(k);
      hi.push(t);
      if (hi.length >= 300) break;
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
