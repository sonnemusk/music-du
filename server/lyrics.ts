/**
 * Lyric resolve with multi-step fallback:
 * 1) NetEase lyric by song id (ChKSz)
 * 2) Re-search same title/artist → try top candidates' lyrics
 * 3) LRCLIB public API (synced lyrics)
 *
 * Server memory cache short-TTL; browser has its own durable cache.
 */
import * as chksz from "./chksz.js";

export type LyricBundle = {
  lrc: string;
  tlrc: string;
  romalrc?: string;
  klyric?: string;
  /** where lyrics came from */
  source: "netease" | "search" | "lrclib" | "none";
  /** id that actually had lyrics (may differ after rematch) */
  matchedId?: string;
};

const EMPTY: LyricBundle = {
  lrc: "",
  tlrc: "",
  romalrc: "",
  klyric: "",
  source: "none",
};

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h server memory
const cache = new Map<string, { at: number; data: LyricBundle }>();

function hasUsableLrc(lrc: string): boolean {
  const s = (lrc || "").trim();
  if (s.length < 8) return false;
  // pure instrumental / empty placeholders
  if (/^作词|作曲|编曲|纯音乐|暂无歌词|该歌曲为没有填词/i.test(s) && s.length < 40) {
    return false;
  }
  // prefer timed lines
  if (/\[[0-9]{1,2}:[0-9]{2}/.test(s)) return true;
  // plain text long enough
  return s.length >= 30;
}

function cleanQueryPart(s: string): string {
  return String(s || "")
    .replace(/\(.*?\)|（.*?）|\[.*?\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreTitleArtist(
  wantName: string,
  wantArtist: string,
  hitName: string,
  hitArtist: string
): number {
  const n1 = cleanQueryPart(wantName).toLowerCase();
  const n2 = cleanQueryPart(hitName).toLowerCase();
  let s = 0;
  if (!n1 || !n2) return 0;
  if (n1 === n2) s += 100;
  else if (n2.includes(n1) || n1.includes(n2)) s += 55;
  else if (n1.slice(0, 2) === n2.slice(0, 2)) s += 15;

  const a1 = cleanQueryPart(wantArtist).toLowerCase().split(/[/,、&]/)[0] || "";
  const a2 = cleanQueryPart(hitArtist).toLowerCase();
  if (a1 && a2) {
    if (a2.includes(a1) || a1.includes(a2.split(/[/,、]/)[0] || "")) s += 40;
  }
  return s;
}

async function fromNeteaseId(
  sid: string | number,
  opts?: { apikey?: string }
): Promise<LyricBundle | null> {
  try {
    const d = await chksz.fetchLyric(sid, opts);
    if (hasUsableLrc(d.lrc) || hasUsableLrc(d.tlrc)) {
      return {
        lrc: d.lrc || "",
        tlrc: d.tlrc || "",
        romalrc: d.romalrc || "",
        klyric: d.klyric || "",
        source: "netease",
        matchedId: String(sid),
      };
    }
  } catch {
    /* */
  }
  return null;
}

async function fromSearchRematch(
  name: string,
  artist: string,
  skipId: string,
  opts?: { apikey?: string }
): Promise<LyricBundle | null> {
  const q = [cleanQueryPart(name), cleanQueryPart(artist)].filter(Boolean).join(" ");
  if (!q) return null;
  try {
    let hits = await chksz.search(q, 8, opts);
    if (!hits.length && name) {
      hits = await chksz.search(cleanQueryPart(name), 8, opts);
    }
    // rank by name/artist similarity
    const ranked = hits
      .map((h) => ({
        h,
        score: scoreTitleArtist(name, artist, h.name || "", h.artist || ""),
      }))
      .filter((x) => String(x.h.id) !== String(skipId))
      .sort((a, b) => b.score - a.score);

    for (const { h, score } of ranked.slice(0, 5)) {
      if (score < 40 && ranked[0]?.score < 40) {
        // still try top result even if weak match
      }
      const lyr = await fromNeteaseId(h.id, opts);
      if (lyr) {
        return { ...lyr, source: "search", matchedId: String(h.id) };
      }
    }
  } catch {
    /* */
  }
  return null;
}

async function fromLrclib(
  name: string,
  artist: string,
  durationMs?: number
): Promise<LyricBundle | null> {
  const track = cleanQueryPart(name);
  const art = cleanQueryPart(artist).split(/[/,、&]/)[0] || "";
  if (!track) return null;

  const tryUrls: string[] = [];
  if (art) {
    const q = new URLSearchParams({
      track_name: track,
      artist_name: art,
    });
    if (durationMs && durationMs > 1000) {
      q.set("duration", String(Math.round(durationMs / 1000)));
    }
    tryUrls.push(`https://lrclib.net/api/search?${q.toString()}`);
  }
  tryUrls.push(
    `https://lrclib.net/api/search?q=${encodeURIComponent([track, art].filter(Boolean).join(" "))}`
  );

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10000);
  try {
    for (const url of tryUrls) {
      try {
        const r = await fetch(url, {
          signal: ac.signal,
          headers: {
            Accept: "application/json",
            "User-Agent": "MusicApp/2.0 (personal; lyrics fallback)",
          },
        });
        if (!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data) ? data : data ? [data] : [];
        // prefer synced, good name match
        const ranked = list
          .map((item: any) => ({
            item,
            score:
              scoreTitleArtist(
                track,
                art,
                String(item.trackName || item.name || ""),
                String(item.artistName || item.artist || "")
              ) + (item.syncedLyrics ? 30 : item.plainLyrics ? 5 : 0),
          }))
          .sort((a: any, b: any) => b.score - a.score);

        for (const { item } of ranked.slice(0, 4)) {
          const synced = String(item.syncedLyrics || "").trim();
          const plain = String(item.plainLyrics || "").trim();
          const lrc = hasUsableLrc(synced) ? synced : hasUsableLrc(plain) ? plain : "";
          if (!lrc) continue;
          return {
            lrc,
            tlrc: "",
            source: "lrclib",
            matchedId: item.id != null ? `lrclib:${item.id}` : undefined,
          };
        }
      } catch {
        continue;
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return null;
}

export type ResolveLyricOpts = {
  apikey?: string;
  name?: string;
  artist?: string;
  duration?: number;
  force?: boolean;
};

export async function resolveLyrics(
  sid: string | number,
  opts?: ResolveLyricOpts
): Promise<LyricBundle> {
  const id = String(sid);
  const name = opts?.name || "";
  const artist = opts?.artist || "";
  const cacheKey = `${id}|${cleanQueryPart(name)}|${cleanQueryPart(artist)}`;

  if (!opts?.force) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
    // also try pure id cache
    const byId = cache.get(id);
    if (byId && Date.now() - byId.at < CACHE_TTL_MS && byId.data.source !== "none") {
      return byId.data;
    }
  }

  // 1) direct
  let result = await fromNeteaseId(id, { apikey: opts?.apikey });

  // 2) rematch via search
  if (!result && (name || artist)) {
    result = await fromSearchRematch(name, artist, id, { apikey: opts?.apikey });
  }

  // 3) lrclib
  if (!result && name) {
    result = await fromLrclib(name, artist, opts?.duration);
  }

  const final = result || { ...EMPTY };
  cache.set(cacheKey, { at: Date.now(), data: final });
  if (final.source !== "none") cache.set(id, { at: Date.now(), data: final });
  return final;
}

export function _clearLyricServerCache() {
  cache.clear();
}
