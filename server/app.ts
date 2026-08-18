import { Hono } from "hono";
import { cors } from "hono/cors";
import { parseImportPayload, type ExactImportRow } from "./favs-import.js";
import { isSafeUpstreamUrl } from "./safe-url.js";
import {
  getChart,
  isChartPlatform,
  listChartBoards,
  listChartPlatforms,
  type ChartPlatformId,
} from "./charts.js";
import * as chksz from "./chksz.js";
import { CHKSZ_APIKEY } from "./config.js";
import { fetchAndCacheCover, readCoverCache } from "./cover-cache.js";
import { getLibrary, type ListType } from "./library.js";
import { resolveLyrics } from "./lyrics.js";
import { chooseAudioSrc, onRemoteError, resolvePlay } from "./play.js";
import {
  envLibraryReadonly,
  libraryGate,
  publicReadonlyLibraryData,
} from "./site-mode.js";

function envLibraryToken(): string {
  return (process.env.LIBRARY_TOKEN || process.env.MUSIC_LIBRARY_TOKEN || "").trim();
}

function requestToken(c: { req: { header: (n: string) => string | undefined } }): string {
  const raw = c.req.header("authorization") || c.req.header("x-library-token") || "";
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return (m?.[1] || raw).trim();
}

function corsOrigin(origin: string): string | undefined {
  if (!origin) return "*";
  const extra = (process.env.MUSIC_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);
  if (extra.includes("*") || extra.includes(origin)) return origin;
  try {
    const u = new URL(origin);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return origin;
  } catch {
    /* */
  }
  return undefined;
}

function clampSearchLimit(raw: string | undefined): number {
  const n = Number(raw || 20);
  if (!Number.isFinite(n)) return 20;
  return Math.min(20, Math.max(1, Math.floor(n)));
}

function publicUpstreamError(e: unknown): string {
  if (e instanceof chksz.ChkszError && e.status === 429) return "rate limited";
  return "upstream error";
}

export function createApp(opts?: {
  library?: ReturnType<typeof getLibrary>;
  apikey?: string;
  readonly?: boolean;
  libraryToken?: string;
}) {
  const app = new Hono();
  const lib = opts?.library || getLibrary();
  const keyOf = () => opts?.apikey ?? CHKSZ_APIKEY;
  const readonlyOf = () =>
    opts?.readonly !== undefined ? opts.readonly : envLibraryReadonly();
  const tokenOf = () =>
    opts?.libraryToken !== undefined ? opts.libraryToken : envLibraryToken();

  const checkLib = (c: { req: { method: string; header: (n: string) => string | undefined } }) =>
    libraryGate({
      method: c.req.method,
      readonly: readonlyOf(),
      expectedToken: tokenOf(),
      gotToken: requestToken(c),
    });

  app.use(
    "/api/*",
    cors({
      origin: (origin) => corsOrigin(origin || ""),
      allowHeaders: ["Content-Type", "Authorization", "X-Library-Token"],
    })
  );

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "music",
      provider: "chksz",
      runtime: "node-hono",
      has_apikey: Boolean(keyOf()),
      primary_needs_key: true,
      demo: false,
      readOnly: readonlyOf(),
      library_token_required: Boolean(tokenOf()),
      project: "music-du",
      version: 2,
    })
  );

  app.get("/api/search", async (c) => {
    const q = c.req.query("q") || c.req.query("keyword") || "";
    const limit = clampSearchLimit(c.req.query("limit"));
    try {
      const songs = await chksz.searchAll(q, limit, { apikey: keyOf() });
      return c.json({ ok: true, data: songs });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 500;
      return c.json({ ok: false, error: publicUpstreamError(e) }, status as any);
    }
  });

  /** Multi-platform charts: platforms + boards (soar/hot/new) */
  app.get("/api/charts", (c) =>
    c.json({
      ok: true,
      data: {
        platforms: listChartPlatforms(),
        boards: listChartBoards(),
        defaultBoard: "soar",
        note: "default board: soar (trending); hot = long-term popularity",
      },
    })
  );

  app.get("/api/charts/:platform", async (c) => {
    const platform = c.req.param("platform");
    if (!isChartPlatform(platform)) {
      return c.json(
        {
          ok: false,
          error: `unknown platform (use: ${listChartPlatforms()
            .map((p) => p.id)
            .join(", ")})`,
        },
        400
      );
    }
    const limit = Number(c.req.query("limit") || 40) || 40;
    const force = c.req.query("force") === "1" || c.req.query("refresh") === "1";
    const board = c.req.query("board") || c.req.query("type") || "soar";
    try {
      const data = await getChart(platform as ChartPlatformId, {
        apikey: keyOf(),
        limit,
        force,
        board,
      });
      // soar fresher; browser may revalidate
      const maxAge = data.board === "soar" ? 7200 : data.board === "new" ? 10800 : 28800;
      c.header(
        "Cache-Control",
        `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`
      );
      return c.json({
        ok: true,
        data: {
          ...data,
          cache: {
            board: data.board,
            sourceLabel: data.sourceLabel,
            updatedAt: data.updatedAt,
          },
        },
      });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 502;
      return c.json({ ok: false, error: publicUpstreamError(e) }, status as any);
    }
  });

  app.get("/api/song/:sid", async (c) => {
    const sid = c.req.param("sid");
    const level = c.req.query("level");
    const withQualities = c.req.query("qualities") === "1";
    try {
      const src = await resolvePlay(sid, level, { apikey: keyOf() });
      if (src.source === "none" && !src.meta) {
        return c.json({ ok: false, error: "no url" }, 404);
      }
      const stream = `/api/stream/${sid}${level ? `?level=${encodeURIComponent(level)}` : ""}`;
      const remoteUrl = src.source === "remote" ? src.url : "";
      let qualities: chksz.ProbedQuality[] | undefined;
      if (withQualities) {
        qualities = await chksz.probeTopQualities(sid, 3, { apikey: keyOf() });
      }
      return c.json({
        ok: true,
        data: {
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
          ...(qualities ? { qualities } : {}),
        },
      });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 500;
      return c.json({ ok: false, error: publicUpstreamError(e) }, status as any);
    }
  });

  /** Top N qualities that actually have a URL for this track (ladder high→low). */
  app.get("/api/song/:sid/qualities", async (c) => {
    const sid = c.req.param("sid");
    const limit = Math.min(5, Math.max(1, Number(c.req.query("limit") || 3)));
    try {
      const qualities = await chksz.probeTopQualities(sid, limit, { apikey: keyOf() });
      return c.json({ ok: true, data: { id: sid, qualities } });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 500;
      return c.json({ ok: false, error: publicUpstreamError(e) }, status as any);
    }
  });

  app.get("/api/lyric/:sid", async (c) => {
    try {
      const d = await resolveLyrics(c.req.param("sid"), {
        apikey: keyOf(),
        name: c.req.query("name") || c.req.query("title") || "",
        artist: c.req.query("artist") || "",
        duration: Number(c.req.query("duration") || 0) || 0,
        force: c.req.query("force") === "1",
      });
      c.header("Cache-Control", "private, max-age=3600");
      return c.json({ ok: true, data: d });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 500;
      return c.json({ ok: false, error: publicUpstreamError(e) }, status as any);
    }
  });

  app.get("/api/stream/:sid", async (c) => {
    try {
      const raw = await chksz.fetchMusic(c.req.param("sid"), c.req.query("level"), {
        apikey: keyOf(),
      });
      const audioUrl = raw?.url || "";
      if (!chksz.isRemoteUrl(audioUrl) || !isSafeUpstreamUrl(audioUrl)) return c.body(null, 404);
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://music.163.com/",
      };
      const range = c.req.header("Range");
      if (range) headers.Range = range;
      // Q-1: AbortController timeout (Node path previously unbounded)
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 45_000);
      let up: Response;
      try {
        up = await fetch(audioUrl, { headers, signal: ac.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!up.ok) return c.body(null, 502);
      const out = new Headers(up.headers);
      out.set("X-Play-Source", "stream-fallback");
      out.set("Cache-Control", "private, max-age=60");
      return new Response(up.body, { status: up.status, headers: out });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 502;
      return c.json({ ok: false, error: publicUpstreamError(e) }, status as any);
    }
  });

  app.get("/api/cover-proxy", async (c) => {
    const url = c.req.query("url") || "";
    if (!url.startsWith("http")) {
      return new Response(null, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    try {
      const { isAllowedCoverUrl } = await import("./cover-fetch.js");
      if (!isAllowedCoverUrl(url)) {
        return new Response(null, {
          status: 403,
          headers: { "Cache-Control": "no-store" },
        });
      }
      // Disk cache first (fast path for charts / replay)
      const disk = readCoverCache(url);
      // public + s-maxage: free CF orange-cloud CDN can cache if domain is proxied
      const coverHeaders = (ct: string, mark: string) => ({
        "Content-Type": ct,
        "Cache-Control":
          "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
        "CDN-Cache-Control": "public, max-age=604800",
        "X-Cover-Cache": mark,
      });
      if (disk) {
        return new Response(new Uint8Array(disk.body), {
          headers: coverHeaders(disk.contentType, "HIT"),
        });
      }
      const hit = await fetchAndCacheCover(url);
      if (!hit) {
        return new Response(null, {
          status: 502,
          headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store" },
        });
      }
      return new Response(new Uint8Array(hit.body), {
        headers: coverHeaders(hit.contentType, hit.fromCache ? "HIT" : "MISS"),
      });
    } catch {
      return new Response(null, {
        status: 502,
        headers: { "Cache-Control": "no-store" },
      });
    }
  });

  app.get("/api/library", (c) => {
    const gate = checkLib(c);
    if (!gate.ok) return c.json({ ok: false, error: gate.error, readOnly: gate.readOnly }, gate.status as any);
    const data = lib.load();
    const payload = readonlyOf() ? publicReadonlyLibraryData(data as any) : data;
    return c.json({ ok: true, data: payload, readOnly: readonlyOf() });
  });

  /** Short URL: open /favs to download favorites JSON. */
  const favoritesExport = (c: {
    req: { method: string; url: string; header: (n: string) => string | undefined };
  }) => {
    const gate = checkLib(c);
    if (!gate.ok) {
      return new Response(JSON.stringify({ ok: false, error: gate.error, readOnly: gate.readOnly }), {
        status: gate.status,
        headers: { "Content-Type": "application/json;charset=utf-8" },
      });
    }
    if (readonlyOf()) {
      return new Response(JSON.stringify({ ok: false, error: "export disabled on demo", readOnly: true }), {
        status: 403,
        headers: { "Content-Type": "application/json;charset=utf-8" },
      });
    }
    const data = lib.load();
    const favorites = (data.favorites || []).map((t: any) => ({
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
  };
  app.get("/favs", favoritesExport);
  app.get("/export", favoritesExport);

  app.put("/api/library", async (c) => {
    const gate = checkLib(c);
    if (!gate.ok) return c.json({ ok: false, error: gate.error, readOnly: gate.readOnly }, gate.status as any);
    try {
      const body = await c.req.json().catch(() => ({}));
      const data = lib.mergePut(body, {
        forceClearPlaylist: Boolean(body.forceClearPlaylist || body.force_clear_playlist),
        forceClearFavorites: Boolean(body.forceClearFavorites || body.force_clear_favorites),
        forceClearHistory: Boolean(body.forceClearHistory || body.force_clear_history),
      });
      return c.json({ ok: true, data });
    } catch (e: any) {
      if (e?.conflict) return c.json({ ok: false, error: "conflict", data: e.data }, 409);
      console.error(e);
      return c.json({ ok: false, error: "library save failed" }, 500);
    }
  });

  app.delete("/api/library/:listType/:sid", (c) => {
    const gate = checkLib(c);
    if (!gate.ok) return c.json({ ok: false, error: gate.error, readOnly: gate.readOnly }, gate.status as any);
    const listType = c.req.param("listType") as ListType;
    if (!["playlist", "favorites", "history"].includes(listType)) {
      return c.json({ ok: false, error: "bad list" }, 400);
    }
    try {
      const revRaw = c.req.query("revision");
      const clientRev =
        revRaw != null && revRaw !== "" ? Number(revRaw) : null;
      const data = lib.deleteSid(listType, c.req.param("sid"), clientRev);
      return c.json({ ok: true, data });
    } catch (e: any) {
      if (e?.conflict) {
        return c.json({ ok: false, error: "conflict", conflict: true, data: e.data }, 409);
      }
      console.error(e);
      return c.json({ ok: false, error: "library delete failed" }, 500);
    }
  });

  const importPage = (msg?: string, ok = true) =>
    `<!doctype html><meta charset="utf-8"><title>Import</title>
     <p>${msg || "Upload a /favs JSON export."}</p>
     ${ok ? `<form method="post" action="/import" enctype="multipart/form-data">
       <input type="file" name="file" required>
       <button type="submit">Import</button>
     </form>` : ""}`;

  app.get("/import", (c) => {
    if (readonlyOf()) return c.html(importPage("read-only demo", false), 403);
    return c.html(importPage());
  });

  app.post("/import", async (c) => {
    const gate = checkLib(c);
    if (!gate.ok) return c.html(importPage(gate.error, false), gate.status as any);
    try {
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
      } else {
        text = await c.req.text();
      }
      if (text.length > 2 * 1024 * 1024) return c.html(importPage("file too large", false), 413);
      const parsed = parseImportPayload(text);
      if (!parsed.ok) return c.html(importPage(parsed.error, false), 400);
      const tracks = parsed.rows.filter((r): r is ExactImportRow => r.kind === "exact");
      if (!tracks.length) return c.html(importPage("no exact ids in file", false), 400);
      const data = lib.mergePut(
        { favorites: tracks },
        { forceClearFavorites: false }
      );
      return c.html(importPage(`imported ${tracks.length} · library ${data.favorites.length}`));
    } catch (e: any) {
      if (e?.conflict) return c.html(importPage("revision conflict", false), 409);
      console.error(e);
      return c.html(importPage("import failed", false), 500);
    }
  });

  app.post("/api/play/resolve", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const meta = body.meta || {};
    const stream = body.stream || `/api/stream/${meta.id || "0"}`;
    if (body.remote_failed) return c.json({ ok: true, data: onRemoteError(stream) });
    return c.json({ ok: true, data: chooseAudioSrc(meta, stream) });
  });

  return app;
}
