/**
 * ChKSz NetEase adapter.
 *
 * Primary:  https://api.chksz.top  — free, NO apikey
 * Fallback: https://api.chksz.com — needs apikey(s), round-robin
 */
import {
  CHKSZ_APIKEY,
  chkszComKeys,
  chkszFallbackBase,
  chkszPrimaryBase,
  qualityLevels,
} from "./config.js";
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

/** Round-robin cursor for .com keys (module-level; Workers isolate per isolate). */
let comKeyCursor = 0;

export function setHttpTransport(fn: Transport | null) {
  transport = fn;
}

/** Test helper — reset RR cursor. */
export function resetKeyRotationForTests() {
  comKeyCursor = 0;
}

export function tryHttps(url: string): string {
  if (!url) return "";
  const u = String(url).trim();
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("http://")) return "https://" + u.slice(7);
  return u;
}

/** Only for .com backup paths that truly need a key. */
export function requireApikey(key = CHKSZ_APIKEY): string {
  if (!key) {
    throw new ChkszError(
      "CHKSZ_FALLBACK_APIKEYS not configured (needed for api.chksz.com)",
      401
    );
  }
  return key;
}

function buildUrl(
  baseIn: string,
  path: string,
  params: Record<string, string | number>,
  apikey: string
) {
  let p = path.startsWith("/") ? path : `/${path}`;
  const base = baseIn.replace(/\/$/, "");
  if (base.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  const u = new URL(base + p);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  // Free .top: never attach apikey. Paid .com: only when key present.
  if (apikey) u.searchParams.set("apikey", apikey);
  return u.toString();
}

type Attempt = { base: string; key: string; label: string };

function splitOptKeys(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[,;\n\r\t]+/)) {
    const k = part.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * Try order:
 * 1) free primary base (.top) — always no apikey
 * 2) paid fallback (.com) × com keys, round-robin start each call
 *
 * Mock transport (unit tests): only primary, no key (unless test forces opts.apikey
 * solely for asserting param plumbing — still not required).
 */
function buildAttempts(opts?: { apikey?: string }): Attempt[] {
  const primary = chkszPrimaryBase();
  const fallback = chkszFallbackBase();

  // Primary free gateway: never requires / sends key
  const out: Attempt[] = [{ base: primary, key: "", label: "primary-free" }];

  // Unit tests with injected transport: free primary only (no .com fan-out)
  if (transport) return out;

  if (!fallback) return out;

  // .com keys from env; opts.apikey only fills in when env has none
  let comKeys = chkszComKeys();
  if (!comKeys.length && opts?.apikey?.trim()) {
    comKeys = splitOptKeys(opts.apikey);
  }

  if (!comKeys.length) return out; // free-only mode when no com keys configured

  const start = comKeyCursor % comKeys.length;
  comKeyCursor += 1;
  for (let i = 0; i < comKeys.length; i++) {
    const key = comKeys[(start + i) % comKeys.length]!;
    out.push({
      base: fallback,
      key,
      label: `com#${i + 1}`,
    });
  }
  return out;
}

function isRetryableStatus(status: number): boolean {
  // 403 on .top is often CF bot score — one fallback is enough, not every key.
  return status === 401 || status === 402 || status === 403 || status === 429 || status >= 500;
}

/** Some edges answer HTTP 200 with an HTML 403/challenge page. Treat that as retryable. */
export function interpretUpstreamHttp(
  status: number,
  text: string,
  contentType = ""
): { status: number; body: any } {
  const trimmed = String(text || "").trim();
  const looksJson =
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    contentType.toLowerCase().includes("json");
  if (looksJson && trimmed) {
    try {
      return { status, body: JSON.parse(trimmed) };
    } catch {
      /* fall through */
    }
  }
  const blocked = /403 Forbidden|just a moment|cf-browser-verification|attention required/i.test(
    text || ""
  );
  // HTML 404/403 from the free edge is not a real "song missing" — retry fallback.
  return {
    status: blocked ? 403 : 502,
    body: { error: blocked ? "forbidden" : "upstream non-json" },
  };
}

async function rawGet(
  base: string,
  path: string,
  params: Record<string, string | number>,
  key: string,
  timeout: number
): Promise<{ status: number; body: any }> {
  const url = buildUrl(base, path, params, key);
  if (transport) {
    const transportParams: Record<string, string | number> = { ...params };
    if (key) transportParams.apikey = key;
    const r = await transport("GET", url, {
      params: transportParams,
      timeout,
    });
    return { status: r.status, body: await r.json() };
  }
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, {
      headers: {
        Accept: "application/json",
        // .com sits behind CF bot score; bare fetch UA can 403 even with a valid key
        "User-Agent": "music-du/2.0 (+https://music.dubin.cc)",
      },
      signal: ac.signal,
    });
    const text = await r.text();
    return interpretUpstreamHttp(r.status, text, r.headers.get("content-type") || "");
  } finally {
    clearTimeout(t);
  }
}

async function apiGet(
  path: string,
  params: Record<string, string | number> = {},
  opts?: { apikey?: string; timeout?: number }
): Promise<{ status: number; body: any }> {
  // Free Workers: primary + at most one fallback host (not every .com key).
  const attempts = buildAttempts(opts).slice(0, 2);
  const timeout = opts?.timeout ?? 12000;
  let last: { status: number; body: any } | null = null;
  let lastErr: unknown = null;

  for (let i = 0; i < attempts.length; i++) {
    const a = attempts[i]!;
    try {
      const res = await rawGet(a.base, path, params, a.key, timeout);
      last = res;
      // Success or non-retryable client error (e.g. 404) — stop
      if (!isRetryableStatus(res.status)) return res;
      // Retryable: try next key/base if any
      if (i < attempts.length - 1) continue;
      return res;
    } catch (e) {
      lastErr = e;
      // Network / abort → try next
      if (i < attempts.length - 1) continue;
      if (e instanceof ChkszError) throw e;
      throw new ChkszError(
        e instanceof Error ? e.message : "upstream request failed",
        502
      );
    }
  }

  if (last) return last;
  if (lastErr instanceof ChkszError) throw lastErr;
  throw new ChkszError("upstream request failed", 502);
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
  // Cap ladder walk: requested + next 3. Full 8-level walk is 8+ subrequests.
  for (const lv of qualityLevels(level).slice(0, 4)) {
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
