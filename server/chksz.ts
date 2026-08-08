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

export async function fetchMusic(
  sid: string | number,
  level?: string | null,
  opts?: { apikey?: string }
): Promise<Record<string, any>> {
  for (const lv of qualityLevels(level)) {
    try {
      const { status, body } = await apiGet(
        "/api/163_music",
        { id: String(sid), level: lv },
        { ...opts, timeout: 12000 }
      );
      if ([401, 402, 403, 429].includes(status)) checkAuth(status, body);
      if (status >= 500) continue;
      let raw = body?.data;
      if (Array.isArray(raw)) raw = raw[0] || {};
      if (!raw || typeof raw !== "object") {
        if (body?.url) raw = body;
        else continue;
      }
      const code = body?.code;
      if (code != null && code !== 200 && code !== 0) continue;
      const url = tryHttps(String(raw.url || "").trim());
      if (!url.startsWith("http")) continue;
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
      continue;
    }
  }
  return {};
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
