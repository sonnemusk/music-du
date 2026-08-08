import { Hono } from "hono";
import { cors } from "hono/cors";
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

export function createApp(opts?: {
  library?: ReturnType<typeof getLibrary>;
  apikey?: string;
}) {
  const app = new Hono();
  const lib = opts?.library || getLibrary();
  const keyOf = () => opts?.apikey ?? CHKSZ_APIKEY;

  app.use("/api/*", cors());

  app.get("/api/health", (c) =>
    c.json({
      ok: true,
      service: "music",
      provider: "chksz",
      runtime: "node-hono",
      has_apikey: Boolean(keyOf()),
      version: 2,
    })
  );

  app.get("/api/search", async (c) => {
    const q = c.req.query("q") || c.req.query("keyword") || "";
    const limit = Number(c.req.query("limit") || 30) || 30;
    try {
      const songs = await chksz.search(q, limit, { apikey: keyOf() });
      return c.json({ ok: true, data: songs });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 500;
      return c.json({ ok: false, error: e?.message || String(e) }, status as any);
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
        note: "默认飙升榜更接近「正在火」；热歌榜偏长青综合热度",
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
      return c.json({ ok: false, error: e?.message || String(e) }, status as any);
    }
  });

  app.get("/api/song/:sid", async (c) => {
    const sid = c.req.param("sid");
    const level = c.req.query("level");
    try {
      const src = await resolvePlay(sid, level, { apikey: keyOf() });
      if (src.source === "none" && !src.meta) {
        return c.json({ ok: false, error: "no url" }, 404);
      }
      const stream = `/api/stream/${sid}`;
      const remoteUrl = src.source === "remote" ? src.url : "";
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
        },
      });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 500;
      return c.json({ ok: false, error: e?.message || String(e) }, status as any);
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
      return c.json({ ok: false, error: e?.message || String(e) }, status as any);
    }
  });

  app.get("/api/stream/:sid", async (c) => {
    try {
      const raw = await chksz.fetchMusic(c.req.param("sid"), c.req.query("level"), {
        apikey: keyOf(),
      });
      const audioUrl = raw?.url || "";
      if (!chksz.isRemoteUrl(audioUrl)) return c.body(null, 404);
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "*/*",
        Referer: "https://music.163.com/",
      };
      const range = c.req.header("Range");
      if (range) headers.Range = range;
      const up = await fetch(audioUrl, { headers });
      if (!up.ok) return c.body(null, 502);
      const out = new Headers(up.headers);
      out.set("X-Play-Source", "stream-fallback");
      out.set("Cache-Control", "private, max-age=60");
      return new Response(up.body, { status: up.status, headers: out });
    } catch (e: any) {
      const status = e instanceof chksz.ChkszError ? e.status : 502;
      return c.json({ ok: false, error: e?.message || String(e) }, status as any);
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
          status: 404,
          headers: { "Cache-Control": "no-store", "CDN-Cache-Control": "no-store" },
        });
      }
      return new Response(new Uint8Array(hit.body), {
        headers: coverHeaders(hit.contentType, hit.fromCache ? "HIT" : "MISS"),
      });
    } catch {
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
  });

  app.get("/api/library", (c) => c.json({ ok: true, data: lib.load() }));

  app.put("/api/library", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const data = lib.mergePut(body, {
        forceClearPlaylist: Boolean(body.forceClearPlaylist || body.force_clear_playlist),
        forceClearFavorites: Boolean(body.forceClearFavorites || body.force_clear_favorites),
        forceClearHistory: Boolean(body.forceClearHistory || body.force_clear_history),
      });
      return c.json({ ok: true, data });
    } catch (e: any) {
      return c.json({ ok: false, error: e?.message || String(e) }, 500);
    }
  });

  app.delete("/api/library/:listType/:sid", (c) => {
    const listType = c.req.param("listType") as ListType;
    if (!["playlist", "favorites", "history"].includes(listType)) {
      return c.json({ ok: false, error: "bad list" }, 400);
    }
    try {
      const data = lib.deleteSid(listType, c.req.param("sid"));
      return c.json({ ok: true, data });
    } catch (e: any) {
      return c.json({ ok: false, error: e?.message || String(e) }, 500);
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
