/**
 * Multi-platform music charts → playable NetEase tracks.
 *
 * Why it used to feel "not hot":
 * - Only 「热歌/TOP」boards (long-window popularity, old hits linger)
 * - 12–24h cache frozen the list further
 *
 * Now each platform has board types:
 * - soar 飙升: rising / viral (default, feels hottest)
 * - hot  热歌: overall heat
 * - new  新歌: new releases
 *
 * Sources (public unofficial endpoints):
 * - 网易: playlists 飙升 19723756 / 热歌 3778678 / 新歌 3779629
 * - QQ: topid 飙升 62 / 热歌 26 / 新歌 27
 * - 抖音: 网易「抖音排行榜」+ QQ「抖音热歌榜」等（非汽水官方 API）
 * - 汽水音乐: 字节系听歌 App，与抖音同公司，但不是同一个产品；榜单常互通
 * - 网络热歌 / 流行指数 / 原创: 额外国内常见榜
 * - 酷狗 / 酷我: 见 SOURCE_MAP
 */
import * as chksz from "./chksz.js";
import type { Track } from "./types.js";

/**
 * Optional durable backends — Node wires disk + cover warm via attach*().
 * Cloudflare Workers: memory only here; edge Cache API lives in worker.ts.
 */
export type ChartDiskCache = {
  read(cacheKey: string): ChartCacheEntry | null;
  write(cacheKey: string, entry: ChartCacheEntry): void;
  clear?(): void;
};

export type ChartCoverWarmer = (coverUrls: string[]) => void;

let diskCache: ChartDiskCache | null = null;
let coverWarmer: ChartCoverWarmer | null = null;

/** VPS only — call from node.ts. Workers must not attach disk. */
export function attachChartDiskCache(backend: ChartDiskCache | null) {
  diskCache = backend;
}

/** VPS only — warm cover files on disk. No-op on CF. */
export function attachChartCoverWarmer(fn: ChartCoverWarmer | null) {
  coverWarmer = fn;
}

export type ChartPlatformId =
  | "douyin"
  | "network"
  | "netease"
  | "qq"
  | "kugou"
  | "kuwo"
  | "index"
  | "original";
/** soar = rising/viral (default); hot = overall; new = new songs */
export type ChartBoardId = "soar" | "hot" | "new";

export type ChartMeta = {
  id: ChartPlatformId;
  name: string;
  short: string;
  description: string;
  /** boards this platform supports */
  boards: ChartBoardId[];
};

export type ChartBoardMeta = {
  id: ChartBoardId;
  name: string;
  short: string;
  description: string;
};

export type ChartTrack = Track & {
  rank: number;
  /** original platform song key (for debug / dedupe) */
  sourceKey?: string;
};

export type ChartPayload = {
  platform: ChartPlatformId;
  board: ChartBoardId;
  name: string;
  description: string;
  sourceLabel: string;
  updatedAt: number;
  tracks: ChartTrack[];
};

export const CHART_BOARDS: ChartBoardMeta[] = [
  {
    id: "soar",
    name: "飙升",
    short: "飙",
    description: "近期上升最快 · 更接近「正在火」",
  },
  {
    id: "hot",
    name: "热歌",
    short: "热",
    description: "站内综合热度 · 常有长青曲",
  },
  {
    id: "new",
    name: "新歌",
    short: "新",
    description: "新发行歌曲热度",
  },
];

export const CHART_PLATFORMS: ChartMeta[] = [
  {
    id: "douyin",
    name: "抖音",
    short: "抖音",
    description:
      "抖音向热歌（网易抖音排行榜 + QQ 抖音热歌榜）。汽水音乐是字节听歌 App，与抖音同系但不是同一个产品",
    boards: ["soar", "hot", "new"],
  },
  {
    id: "network",
    name: "网络热歌",
    short: "网络",
    description: "网络热歌 / 短视频向（更「洗脑」）",
    boards: ["soar", "hot"],
  },
  {
    id: "netease",
    name: "网易云",
    short: "网易",
    description: "网易云官方歌单榜",
    boards: ["soar", "hot", "new"],
  },
  {
    id: "qq",
    name: "QQ 音乐",
    short: "QQ",
    description: "QQ 巅峰榜系列",
    boards: ["soar", "hot", "new"],
  },
  {
    id: "kugou",
    name: "酷狗",
    short: "酷狗",
    description: "酷狗排行榜",
    boards: ["soar", "hot", "new"],
  },
  {
    id: "kuwo",
    name: "酷我",
    short: "酷我",
    description: "酷我榜单",
    boards: ["soar", "hot", "new"],
  },
  {
    id: "index",
    name: "流行指数",
    short: "流行",
    description: "QQ 流行指数榜（相对涨幅，偏「正在起量」）",
    boards: ["soar", "hot"],
  },
  {
    id: "original",
    name: "原创",
    short: "原创",
    description: "网易云原创榜",
    boards: ["hot", "new"],
  },
];

type SourceSpec =
  | { kind: "ne"; playlistId: string; label: string }
  | { kind: "qq"; topid: number; label: string }
  | { kind: "kg"; rankid: number; label: string }
  | { kind: "kw"; bangId: number; label: string };

/**
 * platform × board → upstream source
 *
 * 抖音重点：
 * - soar: 网易「抖音排行榜」2250011882（播放量极大，短视频向更强）
 * - hot:  QQ「抖音热歌榜」60（周更、偏平台官方同步）
 * - new:  网易「2026抖音热歌榜」合集
 */
const SOURCE_MAP: Record<ChartPlatformId, Partial<Record<ChartBoardId, SourceSpec>>> = {
  douyin: {
    soar: {
      kind: "ne",
      playlistId: "2250011882",
      label: "抖音排行榜（网易合集 · 短视频向）",
    },
    hot: { kind: "qq", topid: 60, label: "抖音热歌榜（QQ 官方同步）" },
    new: {
      kind: "ne",
      playlistId: "17920245026",
      label: "2026 抖音热歌榜（网易合集）",
    },
  },
  network: {
    soar: {
      kind: "ne",
      playlistId: "6723173524",
      label: "网络热歌榜（网易）",
    },
    hot: { kind: "qq", topid: 28, label: "QQ · 网络歌曲榜" },
  },
  netease: {
    soar: { kind: "ne", playlistId: "19723756", label: "网易云 · 飙升榜" },
    hot: { kind: "ne", playlistId: "3778678", label: "网易云 · 热歌榜" },
    new: { kind: "ne", playlistId: "3779629", label: "网易云 · 新歌榜" },
  },
  qq: {
    soar: { kind: "qq", topid: 62, label: "QQ · 飙升榜" },
    hot: { kind: "qq", topid: 26, label: "QQ · 热歌榜" },
    new: { kind: "qq", topid: 27, label: "QQ · 新歌榜" },
  },
  kugou: {
    soar: { kind: "kg", rankid: 6666, label: "酷狗 · 飙升榜" },
    hot: { kind: "kg", rankid: 8888, label: "酷狗 · TOP500" },
    new: { kind: "kg", rankid: 31308, label: "酷狗 · 华语新歌" },
  },
  kuwo: {
    soar: { kind: "kw", bangId: 93, label: "酷我 · 飙升榜" },
    hot: { kind: "kw", bangId: 16, label: "酷我 · 热歌榜" },
    new: { kind: "kw", bangId: 17, label: "酷我 · 新歌榜" },
  },
  index: {
    soar: { kind: "qq", topid: 4, label: "QQ · 流行指数榜" },
    hot: { kind: "qq", topid: 4, label: "QQ · 流行指数榜" },
  },
  original: {
    hot: { kind: "ne", playlistId: "2884035", label: "网易云 · 原创榜" },
    new: { kind: "ne", playlistId: "2884035", label: "网易云 · 原创榜" },
  },
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** soar needs fresher data; hot can sit longer */
function cacheWindows(board: ChartBoardId): { fresh: number; ttl: number } {
  if (board === "soar") return { fresh: 2 * 60 * 60 * 1000, ttl: 6 * 60 * 60 * 1000 };
  if (board === "new") return { fresh: 3 * 60 * 60 * 1000, ttl: 8 * 60 * 60 * 1000 };
  return { fresh: 8 * 60 * 60 * 1000, ttl: 20 * 60 * 60 * 1000 };
}

const MAX_TRACKS = 40;

/** Edge Cache-Control max-age (seconds) by board — soar must stay fresher. */
export function chartEdgeMaxAgeSec(board: ChartBoardId): number {
  if (board === "soar") return 2 * 3600;
  if (board === "new") return 3 * 3600;
  return 8 * 3600;
}

/** True when the id can be sent to /api/song (NetEase numeric). */
export function isResolvedSongId(id: string | number | null | undefined): boolean {
  return /^\d+$/.test(String(id ?? "").trim());
}

/**
 * Display id for a chart row. NetEase playlists already have a playable id.
 * QQ/酷狗/酷我 rows keep an `ext:` placeholder — the client searches on click.
 */
export function chartTrackFromRaw(
  row: {
    name: string;
    artist: string;
    album?: string;
    cover?: string;
    duration?: number;
    neteaseId?: string | number;
    sourceKey?: string;
  },
  rank: number
): ChartTrack | null {
  const name = String(row.name || "").trim();
  if (!name) return null;
  const artist = String(row.artist || "").trim();
  let id: string | number;
  if (row.neteaseId != null && String(row.neteaseId).trim() !== "") {
    const raw = String(row.neteaseId).trim();
    id = /^\d+$/.test(raw) ? Number(raw) : raw;
  } else {
    const key = String(row.sourceKey || `${name}|${artist}`).slice(0, 180);
    id = `ext:${key}`;
  }
  return {
    id,
    name,
    artist,
    album: String(row.album || ""),
    cover: String(row.cover || ""),
    duration: Number(row.duration || 0) || 0,
    rank,
    sourceKey: row.sourceKey,
  };
}

type RawRow = {
  name: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: number;
  /** If set, already a NetEase song id — skip search */
  neteaseId?: string | number;
  sourceKey?: string;
};

export type ChartCacheEntry = { at: number; payload: ChartPayload };
const memory = new Map<string, ChartCacheEntry>();
/** platforms currently being built (dedupe concurrent force-refresh) */
const inflight = new Map<string, Promise<ChartPayload>>();

function readCache(cacheKey: string): ChartCacheEntry | null {
  const mem = memory.get(cacheKey);
  if (mem) return mem;
  const disk = diskCache?.read(cacheKey) || null;
  if (disk) {
    memory.set(cacheKey, disk);
    return disk;
  }
  return null;
}

function writeCache(cacheKey: string, payload: ChartPayload) {
  const entry: ChartCacheEntry = { at: Date.now(), payload };
  memory.set(cacheKey, entry);
  try {
    diskCache?.write(cacheKey, entry);
  } catch {
    /* */
  }
}

function scheduleCoverWarm(tracks: ChartTrack[]) {
  if (!coverWarmer) return;
  const urls = tracks.map((t) => t.cover || "").filter(Boolean);
  if (!urls.length) return;
  try {
    coverWarmer(urls);
  } catch {
    /* */
  }
}

function metaOf(id: ChartPlatformId): ChartMeta {
  return CHART_PLATFORMS.find((p) => p.id === id) || CHART_PLATFORMS[0];
}

async function httpJson(url: string, init?: RequestInit): Promise<any> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 14000);
  try {
    const r = await fetch(url, {
      ...init,
      signal: ac.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json,text/plain,*/*",
        ...(init?.headers || {}),
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function cleanName(s: string): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/\(.*?\)|（.*?）|\[.*?\]/g, (m) => {
      // keep feat. hints short; drop long remix tags later if needed
      return m.length > 24 ? "" : m;
    })
    .trim();
}

/** —— fetchers —— */

export async function fetchNeteasePlaylist(
  playlistId: string,
  limit = MAX_TRACKS
): Promise<RawRow[]> {
  const url = `https://music.163.com/api/playlist/detail?id=${encodeURIComponent(playlistId)}`;
  const body = await httpJson(url, {
    headers: { Referer: "https://music.163.com/" },
  });
  const tracks =
    body?.result?.tracks || body?.playlist?.tracks || body?.result?.tracks || [];
  const out: RawRow[] = [];
  for (const t of tracks) {
    if (!t || t.id == null) continue;
    const artists = t.artists || t.ar || [];
    const artist = Array.isArray(artists)
      ? artists
          .map((a: any) => (a && typeof a === "object" ? a.name : String(a || "")))
          .filter(Boolean)
          .join(" / ")
      : "";
    const al = t.album || t.al || {};
    const cover = chksz.tryHttps(
      String(al.picUrl || al.blurPicUrl || t.picUrl || t.cover || "")
    );
    out.push({
      name: String(t.name || ""),
      artist,
      album: String(al.name || ""),
      cover,
      duration: Number(t.duration || t.dt || 0),
      neteaseId: t.id,
      sourceKey: `ne:${t.id}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** @deprecated use fetchNeteasePlaylist */
export async function fetchNeteaseHot(limit = MAX_TRACKS): Promise<RawRow[]> {
  return fetchNeteasePlaylist("3778678", limit);
}

export async function fetchQqToplist(topid: number, limit = MAX_TRACKS): Promise<RawRow[]> {
  const url =
    `https://c.y.qq.com/v8/fcg-bin/fcg_v8_toplist_cp.fcg` +
    `?tpl=3&page=detail&date=&topid=${topid}&type=top` +
    `&song_begin=0&song_num=${limit}&g_tk=5381&loginUin=0&hostUin=0` +
    `&format=json&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
  const body = await httpJson(url, {
    headers: { Referer: "https://y.qq.com/" },
  });
  const list = body?.songlist || [];
  const out: RawRow[] = [];
  for (const item of list) {
    const d = item?.data || item;
    if (!d) continue;
    const name = String(d.songname || d.songName || d.name || "").trim();
    if (!name) continue;
    const singers = d.singer || d.singers || [];
    const artist = Array.isArray(singers)
      ? singers
          .map((s: any) => (s && typeof s === "object" ? s.name : String(s || "")))
          .filter(Boolean)
          .join(" / ")
      : String(d.singername || "");
    const albummid = d.albummid || d.albumMid || "";
    const cover = albummid
      ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albummid}.jpg`
      : "";
    out.push({
      name,
      artist,
      album: String(d.albumname || d.albumName || ""),
      cover,
      duration: Number(d.interval || 0) * 1000 || 0,
      sourceKey: `qq:${d.songmid || d.songid || name}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchKugouRank(rankid = 8888, limit = MAX_TRACKS): Promise<RawRow[]> {
  const url =
    `http://mobilecdn.kugou.com/api/v3/rank/song?version=9108` +
    `&rankid=${rankid}&page=1&pagesize=${limit}&area_code=1&with_cover=1`;
  const body = await httpJson(url);
  const info = body?.data?.info || [];
  const out: RawRow[] = [];
  for (const t of info) {
    const filename = String(t.filename || t.songname || "").trim();
    if (!filename) continue;
    // "歌手 - 歌名" or "歌名"
    let artist = "";
    let name = filename;
    const m = filename.match(/^(.+?)\s*-\s*(.+)$/);
    if (m) {
      artist = m[1].trim();
      name = m[2].trim();
    }
    if (t.authors && Array.isArray(t.authors)) {
      const a = t.authors
        .map((x: any) => x?.author_name || x?.name || "")
        .filter(Boolean)
        .join(" / ");
      if (a) artist = a;
    }
    if (t.songname) name = String(t.songname);
    let cover = String(t.album_sizable_cover || t.sizable_cover || t.imgUrl || "");
    cover = cover.replace(/\{size\}/g, "240");
    cover = chksz.tryHttps(cover);
    out.push({
      name: cleanName(name),
      artist: cleanName(artist),
      album: String(t.remark || t.album_name || ""),
      cover,
      duration: Number(t.duration || 0) * 1000 || 0,
      sourceKey: `kg:${t.hash || t.album_audio_id || filename}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function fetchKuwoBang(bangId = 16, limit = MAX_TRACKS): Promise<RawRow[]> {
  const url =
    `http://kbangserver.kuwo.cn/ksong.s?from=pc&fmt=json&pn=0&rn=${limit}` +
    `&type=bang&data=content&id=${bangId}&show_copyright_off=0&pcmp4=1&isbang=1`;
  const body = await httpJson(url);
  const list = body?.musiclist || body?.musicList || [];
  const out: RawRow[] = [];
  for (const t of list) {
    const name = String(t.name || t.SONGNAME || "").trim();
    if (!name) continue;
    const artist = String(t.artist || t.ARTIST || t.artist_name || "").trim();
    let cover = String(t.pic || t.img || t.albumpic || "");
    // kuwo often uses 120 size path
    if (cover.includes("starheads")) cover = cover.replace(/120/, "240");
    cover = chksz.tryHttps(cover);
    out.push({
      name: cleanName(name),
      artist: cleanName(artist),
      album: String(t.album || t.ALBUM || ""),
      cover,
      duration: Number(t.duration || t.songTimeMinutes || 0) * 1000 || 0,
      sourceKey: `kw:${t.id || t.MUSICRID || name}`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function resolveSource(
  platform: ChartPlatformId,
  board: ChartBoardId
): SourceSpec | null {
  const plat = SOURCE_MAP[platform];
  if (!plat) return null;
  if (plat[board]) return plat[board]!;
  // fallback: prefer hot → soar → new
  return plat.hot || plat.soar || plat.new || null;
}

export function normalizeBoard(
  platform: ChartPlatformId,
  board?: string | null
): ChartBoardId {
  const plat = CHART_PLATFORMS.find((p) => p.id === platform);
  const allowed = plat?.boards || ["hot"];
  const b = (board || "soar") as ChartBoardId;
  if (allowed.includes(b)) return b;
  return allowed[0] || "hot";
}

async function fetchRaw(
  platform: ChartPlatformId,
  board: ChartBoardId,
  limit: number
): Promise<{ rows: RawRow[]; sourceLabel: string }> {
  const src = resolveSource(platform, board);
  if (!src) return { rows: [], sourceLabel: "" };
  if (src.kind === "ne") {
    return { rows: await fetchNeteasePlaylist(src.playlistId, limit), sourceLabel: src.label };
  }
  if (src.kind === "qq") {
    return { rows: await fetchQqToplist(src.topid, limit), sourceLabel: src.label };
  }
  if (src.kind === "kg") {
    return { rows: await fetchKugouRank(src.rankid, limit), sourceLabel: src.label };
  }
  if (src.kind === "kw") {
    return { rows: await fetchKuwoBang(src.bangId, limit), sourceLabel: src.label };
  }
  return { rows: [], sourceLabel: "" };
}

async function buildChart(
  platform: ChartPlatformId,
  board: ChartBoardId,
  limit: number
): Promise<ChartPayload> {
  const meta = metaOf(platform);
  const boardMeta = CHART_BOARDS.find((b) => b.id === board);
  const { rows, sourceLabel } = await fetchRaw(platform, board, limit);
  // Show every row immediately. Playable NetEase ids are used when present;
  // others get an ext: placeholder and the client searches on click.
  const tracks: ChartTrack[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const t = chartTrackFromRaw(row, tracks.length + 1);
    if (!t) continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    tracks.push(t);
    if (tracks.length >= limit) break;
  }

  return {
    platform,
    board,
    name: `${meta.short} · ${boardMeta?.name || board}`,
    description: `${sourceLabel || meta.description} · ${boardMeta?.description || ""}`.trim(),
    sourceLabel: sourceLabel || meta.description,
    updatedAt: Date.now(),
    tracks,
  };
}

export async function getChart(
  platform: ChartPlatformId,
  opts?: { apikey?: string; limit?: number; force?: boolean; board?: ChartBoardId | string }
): Promise<ChartPayload> {
  const board = normalizeBoard(platform, opts?.board);
  const limit = Math.min(MAX_TRACKS, Math.max(10, opts?.limit || MAX_TRACKS));
  const cacheKey = `${platform}:${board}:${limit}`;
  const { fresh, ttl } = cacheWindows(board);
  const now = Date.now();

  if (!opts?.force) {
    const hit = readCache(cacheKey);
    if (hit && hit.payload.tracks.length) {
      const age = now - hit.at;
      if (age < fresh) {
        scheduleCoverWarm(hit.payload.tracks);
        return hit.payload;
      }
      if (age < ttl) {
        if (!inflight.has(cacheKey)) {
          const p = buildChart(platform, board, limit)
            .then((payload) => {
              writeCache(cacheKey, payload);
              scheduleCoverWarm(payload.tracks);
              return payload;
            })
            .catch(() => hit.payload)
            .finally(() => inflight.delete(cacheKey));
          inflight.set(cacheKey, p);
        }
        scheduleCoverWarm(hit.payload.tracks);
        return hit.payload;
      }
    }
  }

  const existing = inflight.get(cacheKey);
  if (existing && !opts?.force) return existing;

  const work = (async () => {
    const payload = await buildChart(platform, board, limit);
    writeCache(cacheKey, payload);
    scheduleCoverWarm(payload.tracks);
    return payload;
  })().finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, work);
  return work;
}

export function listChartPlatforms(): ChartMeta[] {
  return CHART_PLATFORMS.slice();
}

export function listChartBoards(): ChartBoardMeta[] {
  return CHART_BOARDS.slice();
}

export function isChartPlatform(id: string): id is ChartPlatformId {
  return CHART_PLATFORMS.some((p) => p.id === id);
}

export function isChartBoard(id: string): id is ChartBoardId {
  return CHART_BOARDS.some((b) => b.id === id);
}

/**
 * Background warm: default soar + hot for main platforms.
 */
export async function warmAllCharts(opts?: { apikey?: string; limit?: number }): Promise<void> {
  const limit = opts?.limit || MAX_TRACKS;
  const plan: { p: ChartPlatformId; b: ChartBoardId }[] = [
    { p: "douyin", b: "soar" },
    { p: "douyin", b: "hot" },
    { p: "network", b: "soar" },
    { p: "netease", b: "soar" },
    { p: "qq", b: "soar" },
    { p: "index", b: "soar" },
    { p: "kugou", b: "soar" },
    { p: "kuwo", b: "soar" },
  ];
  for (const { p, b } of plan) {
    try {
      await getChart(p, { apikey: opts?.apikey, limit, board: b });
    } catch {
      /* continue */
    }
  }
}

/** Interval revalidate (call from node entry). */
export function startChartWarmLoop(opts?: { apikey?: string }) {
  const run = () => {
    void warmAllCharts({ apikey: opts?.apikey }).catch(() => {});
  };
  setTimeout(run, 8_000);
  // Soar boards: refresh every 2h
  setInterval(run, 2 * 60 * 60 * 1000);
}

/** test helper — clears memory + optional disk chart cache */
export function _clearChartCache() {
  memory.clear();
  inflight.clear();
  try {
    diskCache?.clear?.();
  } catch {
    /* */
  }
}
