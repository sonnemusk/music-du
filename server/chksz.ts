/**
 * ChKSz NetEase adapter — official contract:
 * base https://api.chksz.top (free) or override CHKSZ_API_BASE; auth query `apikey` when required.
 */
import { CHKSZ_API_BASE, CHKSZ_APIKEY, qualityLevels } from "./config.js";
import type { Track } from "./types.js";

export class ChkszError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ChkszError";
    this.status = status;
  }
}

export type Transport = (
  method: string,
  url: string,
  init?: { params?: Record<string, string | number>; timeout?: number }
) => Promise<{ status: number; json: () => Promise<unknown> }>;

let transport: Transport | null = null;

export function setHttpTransport(fn: Transport | null) {
  transport = fn;
}

export function tryHttps(url: string): string {
  if (!url) return "";
  const u = String(url).trim();
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}

export function requireApikey(key = CHKSZ_APIKEY): string {
  if (!key) {
    throw new ChkszError(
      "CHKSZ_APIKEY not configured (set env CHKSZ_APIKEY)",
      401
    );
  }
  return key;
}

function buildUrl(path: string, params: Record<string, string | number>, apikey: string) {
  let p = path.startsWith("/") ? path : `/${path}`;
  let base = CHKSZ_API_BASE.replace(/\/$/, "");
  if (base.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  const u = new URL(base + p);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  u.searchParams.set("apikey", apikey);
  return u.toString();
}

async function apiGet(
  path: string,
  params: Record<string, string | number> = {},
  opts?: { apikey?: string; timeout?: number }
): Promise<{ status: number; body: any }> {
  const key = requireApikey(opts?.apikey ?? CHKSZ_APIKEY);
  const url = buildUrl(path, params, key);
  if (transport) {
    const r = await transport("GET", url, { params: { ...params, apikey: key }, timeout: opts?.timeout });
    return { status: r.status, body: await r.json() };
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), opts?.timeout ?? 12000);
  try {
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: ac.signal,
    });
    let body: any = {};
    try {
      body = await r.json();
    } catch {
      body = {};
    }
    return { status: r.status, body };
  } finally {
    clearTimeout(t);
  }
}

function checkAuth(status: number, body: any) {
  if ([401, 402, 403, 429].includes(status)) {
    const msg =
      body?.msg ||
      body?.error ||
      body?.message ||
      ({ 401: "invalid or missing apikey", 402: "quota exhausted", 403: "forbidden", 429: "rate limited" } as any)[
        status
      ];
    throw new ChkszError(String(msg), status);
  }
  if (status >= 500) throw new ChkszError(`upstream HTTP ${status}`, 502);
}

function extractArtists(track: any): string {
  const ar = track.ar || track.artists || track.artist;
  if (Array.isArray(ar)) {
    return ar
      .map((a) => (a && typeof a === "object" ? a.name || "" : String(a || "")))
      .filter(Boolean)
      .join(" / ");
  }
  if (ar && typeof ar === "object") return String(ar.name || "");
  if (typeof ar === "string") return ar;
  return "";
}

function extractAlbum(track: any): string {
  const al = track.al || track.album;
  if (al && typeof al === "object") return String(al.name || "");
  if (typeof al === "string") return al;
  return "";
}

function extractCover(track: any): string {
  const al = track.al;
  if (al && typeof al === "object" && al.picUrl) return tryHttps(String(al.picUrl));
  if (track.picUrl) return tryHttps(String(track.picUrl));
  if (track.cover) return tryHttps(String(track.cover));
  if (track.album && typeof track.album === "object" && track.album.picUrl) {
    return tryHttps(String(track.album.picUrl));
  }
  return "";
}

export function normalizeSong(s: any): Track {
  return {
    id: s.id,
    name: s.name || "",
    artist: extractArtists(s) || String(s.artist || ""),
    album: extractAlbum(s) || (typeof s.album === "string" ? s.album : ""),
    cover: extractCover(s),
    duration: s.duration || s.dt || 0,
  };
}

export async function search(
  keyword: string,
  limit = 30,
  opts?: { apikey?: string }
): Promise<Track[]> {
  const kw = (keyword || "").trim();
  if (!kw) return [];
  const { status, body } = await apiGet(
    "/api/163_search",
    { keyword: kw, limit },
    { ...opts, timeout: 15000 }
  );
  checkAuth(status, body);
  let tracks: any[] = [];
  const data = body?.data;
  if (Array.isArray(data)) tracks = data;
  else if (data && typeof data === "object") {
    tracks = data.songs || data.tracks || data.list || [];
  } else if (body?.result?.songs) tracks = body.result.songs;
  else if (Array.isArray(body?.list)) tracks = body.list;

  const out: Track[] = [];
  for (const t of tracks) {
    if (!t || typeof t !== "object") continue;
    const n = normalizeSong(t);
    if (n.id != null && n.id !== "") out.push(n);
  }
  return out;
}

/** Try a single quality level only (no fallthrough). */
export async function fetchMusicExact(
  sid: string | number,
  level: string,
  opts?: { apikey?: string }
): Promise<Record<string, any> | null> {
  const lv = String(level || "").trim();
  if (!lv) return null;
  try {
    const { status, body } = await apiGet(
      "/api/163_music",
      { id: String(sid), level: lv },
      { ...opts, timeout: 10000 }
    );
    if ([401, 402, 403, 429].includes(status)) checkAuth(status, body);
    if (status >= 500) return null;
    let raw = body?.data;
    if (Array.isArray(raw)) raw = raw[0] || {};
    if (!raw || typeof raw !== "object") {
      if (body?.url) raw = body;
      else return null;
    }
    const code = body?.code;
    if (code != null && code !== 200 && code !== 0) return null;
    const url = tryHttps(String(raw.url || "").trim());
    if (!url.startsWith("http")) return null;
    return {
      ...raw,
      url,
      level: raw.level || lv,
      _requested_level: lv,
      id: raw.id || sid,
      picUrl: raw.picUrl ? tryHttps(String(raw.picUrl)) : raw.picUrl,
      cover: raw.cover ? tryHttps(String(raw.cover)) : raw.cover,
    };
  } catch (e) {
    if (e instanceof ChkszError) throw e;
    return null;
  }
}

export async function fetchMusic(
  sid: string | number,
  level?: string | null,
  opts?: { apikey?: string }
): Promise<Record<string, any>> {
  for (const lv of qualityLevels(level)) {
    const hit = await fetchMusicExact(sid, lv, opts);
    if (hit) return hit;
  }
  return {};
}

export type ProbedQuality = {
  level: string;
  br: number;
  size: number;
  url: string;
  name?: string;
  artist?: string;
  cover?: string;
};

/**
 * Walk high→low ladder; keep first `limit` levels that actually return a URL.
 * Songs without 母带/沉浸 still get the best 3 that exist (e.g. hires/exhigh/standard).
 * Probes in small parallel batches for lower latency (still free ChKSz calls).
 */
export async function probeTopQualities(
  sid: string | number,
  limit = 3,
  opts?: { apikey?: string }
): Promise<ProbedQuality[]> {
  const max = Math.max(1, Math.min(5, limit || 3));
  const ladder = qualityLevels(null);
  const out: ProbedQuality[] = [];
  const batchSize = 3;
  for (let i = 0; i < ladder.length && out.length < max; i += batchSize) {
    const batch = ladder.slice(i, i + batchSize);
    const hits = await Promise.all(
      batch.map(async (lv) => {
        const hit = await fetchMusicExact(sid, lv, opts);
        return hit?.url
          ? ({
              level: String(hit.level || lv),
              br: Number(hit.br || 0),
              size: Number(hit.size || 0),
              url: String(hit.url),
              name: hit.name ? String(hit.name) : undefined,
              artist: hit.artist ? String(hit.artist) : undefined,
              cover:
                hit.picUrl || hit.cover
                  ? tryHttps(String(hit.picUrl || hit.cover))
                  : undefined,
              _order: ladder.indexOf(lv),
            } as ProbedQuality & { _order: number })
          : null;
      })
    );
    const ok = hits
      .filter(Boolean)
      .sort((a, b) => (a!._order as number) - (b!._order as number)) as (ProbedQuality & {
      _order: number;
    })[];
    for (const h of ok) {
      if (out.length >= max) break;
      // preserve ladder order across batches
      if (out.some((x) => x.level === h.level)) continue;
      const { _order, ...rest } = h;
      void _order;
      out.push(rest);
    }
  }
  // Re-sort by ladder order (batch merges can interleave)
  out.sort(
    (a, b) => ladder.indexOf(a.level) - ladder.indexOf(b.level)
  );
  return out.slice(0, max);
}

export async function fetchLyric(
  sid: string | number,
  opts?: { apikey?: string }
): Promise<{ lrc: string; tlrc: string; romalrc: string; klyric: string }> {
  try {
    const { status, body } = await apiGet(
      "/api/163_lyric",
      { id: String(sid) },
      { ...opts, timeout: 8000 }
    );
    checkAuth(status, body);
    let d: any = body?.data && typeof body.data === "object" ? body.data : {};
    if (!d || (!d.lrc && !d.lyric)) {
      d = {
        lrc:
          body?.lrc && typeof body.lrc === "object"
            ? body.lrc.lyric || ""
            : body?.lrc || "",
        tlyric:
          body?.tlyric && typeof body.tlyric === "object"
            ? body.tlyric.lyric || ""
            : body?.tlyric || "",
        romalrc:
          body?.romalrc && typeof body.romalrc === "object"
            ? body.romalrc.lyric || ""
            : body?.romalrc || "",
      };
    }
    return {
      lrc: d.lrc || d.lyric || "",
      tlrc: d.tlyric || d.tlrc || "",
      romalrc: d.romalrc || "",
      klyric: d.klyric || "",
    };
  } catch (e) {
    if (e instanceof ChkszError) throw e;
    return { lrc: "", tlrc: "", romalrc: "", klyric: "" };
  }
}

export function isRemoteUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
