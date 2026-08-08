import { create } from "zustand";
import * as api from "../lib/api";
import {
  cacheAudioFromStream,
  disposeWarmer,
  getAudioObjectURL,
  hasAudioBlob,
  warmMediaUrl,
} from "../lib/audio-cache";
import {
  getCachedChart,
  getCachedPlatforms,
  prefetchCover,
  prefetchCovers,
  setCachedChart,
  setCachedPlatforms,
} from "../lib/chart-cache";
import {
  getCachedLyric,
  getCachedLyricByMeta,
  hydrateLyricCache,
  prefetchLyric,
  setCachedLyric,
} from "../lib/lyric-cache";
import {
  startPausedBufferPump,
  stopPausedBufferPump,
} from "../lib/buffer-pump";
import {
  bufferedRatio,
  clampSeek,
  clampVolume,
  coverUrl,
  cyclePlayMode,
  fmtTime,
  lyricIndexAt,
  nextQueueIndex,
  parseLyric,
  playModeLabel,
  predictNextIndex,
} from "../lib/player-core";
import {
  cycleRank,
  DEFAULT_QUALITY,
  labelForLevel,
  loadPreferredRank,
  normalizeChoices,
  pickLevelForRank,
  type QualityChoice,
  type QualityRank,
  savePreferredRank,
} from "../lib/quality";
import { prefetchSongResolves } from "../lib/resolve-prefetch";
import {
  getCachedSong,
  hydrateSongCache,
  invalidateCachedSong,
  setCachedSong,
} from "../lib/song-cache";
import type {
  ChartBoard,
  ChartBoardId,
  ChartPlatform,
  ChartPlatformId,
  Library,
  LyricLine,
  PanelTab,
  PlayMode,
  QueueSource,
  SkinId,
  Track,
} from "../lib/types";
import { DEFAULT_SKIN, SKINS } from "../lib/types";

const SKIN_KEY = "kazam.v2.skin";
const LS_KEY = "kazam.v2.library";
const VOL_KEY = "kazam.v2.volume";
const MUTE_KEY = "kazam.v2.muted";
const MODE_KEY = "kazam.v2.playMode";
const CHART_KEY = "kazam.v2.chartPlatform";
const CHART_BOARD_KEY = "kazam.v2.chartBoard";

function effectivePreferredLevel(
  choices: QualityChoice[],
  rank: QualityRank
): string {
  return pickLevelForRank(choices, rank);
}


function norm(t: Track | null | undefined): Track | null {
  if (!t || t.id == null) return null;
  return {
    id: t.id,
    name: t.name || "",
    artist: t.artist || "",
    album: t.album || "",
    cover: t.cover || "",
    duration: t.duration || 0,
    level: t.level || "",
    br: t.br || 0,
    size: t.size || 0,
    rank: t.rank,
  };
}

const CHART_PLATFORM_IDS: ChartPlatformId[] = [
  "douyin",
  "network",
  "netease",
  "qq",
  "kugou",
  "kuwo",
  "index",
  "original",
];

function loadChartPlatform(): ChartPlatformId {
  try {
    const p = localStorage.getItem(CHART_KEY) as ChartPlatformId | null;
    if (p && CHART_PLATFORM_IDS.includes(p)) return p;
  } catch {
    /* */
  }
  // User care most about Douyin viral tracks
  return "douyin";
}

function loadChartBoard(): ChartBoardId {
  try {
    const b = localStorage.getItem(CHART_BOARD_KEY) as ChartBoardId | null;
    if (b && ["soar", "hot", "new"].includes(b)) return b;
  } catch {
    /* */
  }
  return "soar"; // 飙升 = closer to "what's hot now"
}

/** Hard-stop current audio immediately (no network wait). */
export function hardStopAudio(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.pause();
  } catch {
    /* */
  }
  try {
    if (audio.dataset) delete audio.dataset.warmFor;
  } catch {
    /* */
  }
  try {
    audio.removeAttribute("src");
    audio.load();
  } catch {
    /* */
  }
}

type PlayOpts = { from?: QueueSource | PanelTab };

type State = {
  skin: SkinId;
  skinOpen: boolean;
  tab: PanelTab;
  queueSource: QueueSource;
  playlist: Track[];
  favorites: Track[];
  history: Track[];
  searchResults: Track[];
  searchQuery: string;
  searching: boolean;
  chartPlatforms: ChartPlatform[];
  chartBoards: ChartBoard[];
  chartPlatform: ChartPlatformId;
  chartBoard: ChartBoardId;
  chartTracks: Track[];
  chartLoading: boolean;
  chartMetaName: string;
  chartMetaDesc: string;
  chartSourceLabel: string;
  chartUpdatedAt: number;
  curTrack: Track | null;
  curIdx: number;
  playMode: PlayMode;
  playing: boolean;
  loadingPlay: boolean;
  currentTime: number;
  duration: number;
  /** 0–1 how far the current media is buffered (HTMLMediaElement.buffered) */
  buffered: number;
  quality: string;
  /**
   * Rank among this track's available top-3 (0=best).
   * Default 0 → always prefer 母带 when it exists, else next best.
   */
  preferredRank: QualityRank;
  /** Top ≤3 qualities that have a real URL for curTrack */
  availableQualities: QualityChoice[];
  playSource: string;
  lyrics: LyricLine[];
  lyricIdx: number;
  toast: string;
  audioEl: HTMLAudioElement | null;
  playToken: number;
  seeking: boolean;
  volume: number;
  muted: boolean;
  /** Sticky next-track id (esp. shuffle) so prefetch matches the real next() */
  predictedNextId: string | null;

  setAudio: (el: HTMLAudioElement | null) => void;
  setSkin: (s: SkinId) => void;
  cycleSkin: () => void;
  setSkinOpen: (v: boolean) => void;
  setTab: (t: PanelTab) => void;
  setSeeking: (v: boolean) => void;
  bootstrap: () => Promise<void>;
  search: (q: string) => Promise<void>;
  loadCharts: (
    platform?: ChartPlatformId,
    force?: boolean,
    board?: ChartBoardId
  ) => Promise<void>;
  setChartPlatform: (p: ChartPlatformId) => void;
  setChartBoard: (b: ChartBoardId) => void;
  playTrack: (t: Track, opts?: PlayOpts) => Promise<void>;
  togglePlay: () => void;
  next: (delta?: number) => void;
  seek: (ratio: number) => void;
  seekBy: (deltaSec: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  tick: () => void;
  /** Merge external buffer progress (e.g. paused background pump) */
  reportBuffered: (ratio: number) => void;
  /** Continue downloading current track while paused */
  onPlayerPause: () => void;
  onPlayerPlay: () => void;
  cycleMode: () => void;
  /** Rank 0/1/2 among current track's available top-3 */
  setPreferredRank: (rank: QualityRank) => void;
  /** Cycle rank among available qualities for current track */
  cyclePreferredQuality: () => void;
  /** Play a concrete level from availableQualities */
  setQualityLevel: (level: string) => void;
  /** Effective preferred level string for resolve (from rank + available) */
  preferredQuality: string;
  toggleFavorite: (t?: Track | null) => void;
  addToPlaylist: (t: Track) => void;
  removeFromPlaylist: (id: string | number) => void;
  removeFromHistory: (id: string | number) => void;
  showToast: (msg: string) => void;
  isFavorite: (id: string | number) => boolean;
  queue: () => Track[];
  fmt: typeof fmtTime;
  cover: typeof coverUrl;
  modeLabel: () => string;
  /** Resolve + buffer a track without starting playback (home cold-start). */
  warmTrack: (t: Track) => void;
  prefetchAround: (id: string | number) => void;
  recomputePredictedNext: () => void;
};

function loadSkin(): SkinId {
  try {
    const s = localStorage.getItem(SKIN_KEY) as SkinId | null;
    if (s && SKINS.some((x) => x.id === s)) return s;
  } catch {
    /* */
  }
  return DEFAULT_SKIN;
}

function loadVolume(): number {
  try {
    const raw = localStorage.getItem(VOL_KEY);
    if (raw == null) return 1;
    return clampVolume(Number(raw));
  } catch {
    return 1;
  }
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function loadPlayMode(): PlayMode {
  try {
    const m = localStorage.getItem(MODE_KEY) as PlayMode | null;
    // Remember user choice once they change mode
    if (m === "list" || m === "single" || m === "shuffle") return m;
  } catch {
    /* */
  }
  // Default: random / shuffle unless user overrides
  return "shuffle";
}

function applyAudioVolume(audio: HTMLAudioElement | null, volume: number, muted: boolean) {
  if (!audio) return;
  audio.volume = clampVolume(volume);
  audio.muted = muted;
}

function asQueueSource(from?: QueueSource | PanelTab): QueueSource | null {
  if (!from || from === "lyrics") return null;
  if (
    from === "search" ||
    from === "playlist" ||
    from === "favorites" ||
    from === "history" ||
    from === "charts"
  ) {
    return from;
  }
  return null;
}

export const usePlayer = create<State>((set, get) => ({
  skin: typeof window !== "undefined" ? loadSkin() : DEFAULT_SKIN,
  skinOpen: false,
  tab: "search",
  queueSource: "playlist",
  playlist: [],
  favorites: [],
  history: [],
  searchResults: [],
  searchQuery: "",
  searching: false,
  chartPlatforms: [],
  chartBoards: [
    { id: "soar", name: "飙升", short: "飙", description: "近期上升最快" },
    { id: "hot", name: "热歌", short: "热", description: "综合热度" },
    { id: "new", name: "新歌", short: "新", description: "新发行" },
  ],
  chartPlatform: typeof window !== "undefined" ? loadChartPlatform() : "douyin",
  chartBoard: typeof window !== "undefined" ? loadChartBoard() : "soar",
  chartTracks: [],
  chartLoading: false,
  chartMetaName: "",
  chartMetaDesc: "",
  chartSourceLabel: "",
  chartUpdatedAt: 0,
  curTrack: null,
  curIdx: -1,
  playMode: typeof window !== "undefined" ? loadPlayMode() : "shuffle",
  playing: false,
  loadingPlay: false,
  currentTime: 0,
  duration: 0,
  buffered: 0,
  quality: "",
  preferredRank: typeof window !== "undefined" ? loadPreferredRank() : 0,
  availableQualities: [],
  preferredQuality: DEFAULT_QUALITY,
  playSource: "",
  lyrics: [],
  lyricIdx: -1,
  toast: "",
  audioEl: null,
  playToken: 0,
  seeking: false,
  volume: typeof window !== "undefined" ? loadVolume() : 1,
  muted: typeof window !== "undefined" ? loadMuted() : false,
  predictedNextId: null,

  setAudio: (el) => {
    const { volume, muted, curTrack, playing } = get();
    applyAudioVolume(el, volume, muted);
    set({ audioEl: el });
    // bootstrap may finish before <audio> mounts — re-warm onto real element
    if (el && curTrack && !playing && !el.src) {
      get().warmTrack(curTrack);
    }
  },
  setSkin: (s) => {
    try {
      localStorage.setItem(SKIN_KEY, s);
    } catch {
      /* */
    }
    const prev = get().skin;
    set({ skin: s, skinOpen: false });
    if (prev !== s) {
      const meta = SKINS.find((x) => x.id === s);
      get().showToast(`界面 → ${meta?.name || s}`);
    }
  },
  cycleSkin: () => {
    const order = SKINS.map((s) => s.id);
    const i = order.indexOf(get().skin);
    const next = order[(i + 1 + order.length) % order.length] || DEFAULT_SKIN;
    get().setSkin(next);
  },
  setSkinOpen: (v) => set({ skinOpen: v }),
  setTab: (t) => {
    set({ tab: t });
    if (t === "charts") void get().loadCharts();
    // Switching tabs → pre-resolve visible list so click/play hits cache
    const resolve = (id: string | number, opts?: { level?: string }) =>
      api.resolveSong(id, { level: opts?.level || get().preferredQuality });
    if (t === "favorites") {
      prefetchSongResolves(get().favorites, resolve, { level: get().preferredQuality, 
        limit: 48,
        concurrency: 2,
        startDelayMs: 80,
      });
    } else if (t === "playlist") {
      prefetchSongResolves(get().playlist, resolve, { level: get().preferredQuality, 
        limit: 40,
        concurrency: 2,
        startDelayMs: 80,
      });
    } else if (t === "history") {
      prefetchSongResolves(get().history, resolve, { level: get().preferredQuality, 
        limit: 30,
        concurrency: 2,
        startDelayMs: 80,
      });
    } else if (t === "search") {
      prefetchSongResolves(get().searchResults, resolve, { level: get().preferredQuality, 
        limit: 12,
        concurrency: 2,
        startDelayMs: 80,
      });
    }
  },
  setSeeking: (v) => set({ seeking: v }),
  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: "" });
    }, 2200);
  },
  fmt: fmtTime,
  cover: coverUrl,
  modeLabel: () => playModeLabel(get().playMode),
  isFavorite: (id) => get().favorites.some((x) => String(x.id) === String(id)),

  queue: () => {
    const src = get().queueSource;
    const { playlist, favorites, history, searchResults, chartTracks } = get();
    if (src === "charts" && chartTracks.length) return chartTracks;
    if (src === "favorites" && favorites.length) return favorites;
    if (src === "history" && history.length) return history;
    if (src === "search" && searchResults.length) return searchResults;
    if (playlist.length) return playlist;
    if (favorites.length) return favorites;
    if (chartTracks.length) return chartTracks;
    if (history.length) return history;
    return searchResults;
  },

  bootstrap: async () => {
    hydrateSongCache();
    hydrateLyricCache();

    let favorites: Track[] = [];
    let playlist: Track[] = [];
    let history: Track[] = [];
    let curIdx = -1;
    try {
      const lib = await api.loadLibrary();
      playlist = (lib.playlist || []).map(norm).filter(Boolean) as Track[];
      favorites = (lib.favorites || []).map(norm).filter(Boolean) as Track[];
      history = (lib.history || []).map(norm).filter(Boolean) as Track[];
      curIdx = lib.curIdx ?? -1;
      // If local has more favorites (stale thin D1 / wipe), prefer richer local and re-sync
      try {
        const local = JSON.parse(localStorage.getItem(LS_KEY) || "null");
        const localFav = ((local?.favorites || []) as Track[])
          .map(norm)
          .filter(Boolean) as Track[];
        if (localFav.length > favorites.length) {
          const seen = new Set(localFav.map((t) => String(t.id)));
          favorites = [
            ...localFav,
            ...favorites.filter((t) => !seen.has(String(t.id))),
          ];
        }
      } catch {
        /* */
      }
    } catch {
      try {
        const local = JSON.parse(localStorage.getItem(LS_KEY) || "null");
        if (local) {
          playlist = local.playlist || [];
          favorites = local.favorites || [];
          history = local.history || [];
          curIdx = local.curIdx ?? -1;
        }
      } catch {
        /* */
      }
    }

    // Home: open 收藏 + queue follows favorites
    set({
      playlist,
      favorites,
      history,
      curIdx,
      tab: "favorites",
      queueSource: "favorites",
    });

    // Select first favorite + pre-warm (resolve / media / lyrics) — do NOT autoplay.
    // User hits Space or play button when ready; first play then feels like "next track".
    if (favorites.length) {
      const start = favorites[0];
      const startIdx = favorites.findIndex((x) => String(x.id) === String(start.id));
      const cachedLyrics =
        getCachedLyric(start.id) || getCachedLyricByMeta(start.name, start.artist);
      const instantLyrics =
        cachedLyrics && (cachedLyrics.lrc || cachedLyrics.tlrc)
          ? parseLyric(cachedLyrics.lrc || "", cachedLyrics.tlrc || "")
          : [];

      set({
        curTrack: start,
        curIdx: startIdx >= 0 ? startIdx : 0,
        playing: false,
        loadingPlay: false,
        lyrics: instantLyrics,
        lyricIdx: -1,
        currentTime: 0,
        duration: 0,
      });

      // Priority: warm the selected first track + sticky next (same stack as mid-session)
      get().warmTrack(start);
      get().recomputePredictedNext();
      get().prefetchAround(start.id);

      // Pre-resolve favorites / playlist / history URLs in background (not full audio)
      const resolve = (id: string | number, opts?: { level?: string }) =>
      api.resolveSong(id, { level: opts?.level || get().preferredQuality });
      prefetchSongResolves(favorites, resolve, { level: get().preferredQuality, limit: 48,
        concurrency: 2,
        startDelayMs: 350,
      });
      setTimeout(
        () =>
          prefetchSongResolves(playlist, resolve, { level: get().preferredQuality, limit: 36,
            concurrency: 2,
            startDelayMs: 0,
          }),
        2500
      );
      setTimeout(
        () =>
          prefetchSongResolves(history, resolve, { level: get().preferredQuality, limit: 24,
            concurrency: 2,
            startDelayMs: 0,
          }),
        5000
      );

      // Secondary: covers / other lyrics after a short delay so first-track warm wins bandwidth
      setTimeout(() => {
        prefetchCovers(favorites, 24);
        for (const f of favorites.slice(1, 8)) {
          prefetchLyric(
            f.id,
            {
              name: f.name,
              artist: f.artist,
              duration: Number(f.duration || 0) || undefined,
            },
            (id, o) => api.fetchLyric(id, o)
          );
        }
      }, 900);
    } else if (playlist.length || history.length) {
      const resolve = (id: string | number, opts?: { level?: string }) =>
      api.resolveSong(id, { level: opts?.level || get().preferredQuality });
      prefetchSongResolves(playlist, resolve, { level: get().preferredQuality, limit: 36, concurrency: 2, startDelayMs: 400 });
      prefetchSongResolves(history, resolve, { level: get().preferredQuality, limit: 24, concurrency: 2, startDelayMs: 2000 });
    }

    // Prefetch default chart into memory from localStorage + background refresh
    // so opening 热榜 feels instant
    const chartPlat = get().chartPlatform || loadChartPlatform();
    const chartBoard = get().chartBoard || loadChartBoard();
    const cachedPlatforms = getCachedPlatforms();
    if (cachedPlatforms?.length) set({ chartPlatforms: cachedPlatforms });
    const hit = getCachedChart(chartPlat, chartBoard);
    if (hit?.payload?.tracks?.length) {
      set({
        chartPlatform: chartPlat,
        chartBoard: (hit.payload.board as ChartBoardId) || chartBoard,
        chartTracks: hit.payload.tracks.map(norm).filter(Boolean) as Track[],
        chartMetaName: hit.payload.name || "",
        chartMetaDesc: hit.payload.description || "",
        chartSourceLabel: hit.payload.sourceLabel || "",
        chartUpdatedAt: hit.payload.updatedAt || Date.now() - hit.ageMs,
      });
      // Defer chart cover warm — lower priority than home first-track
      setTimeout(() => prefetchCovers(hit.payload.tracks, 40), 1200);
    }
    // Background revalidate (don't block home)
    setTimeout(() => {
      void get().loadCharts(chartPlat, hit?.stale === true, chartBoard);
    }, 1800);
  },

  search: async (q) => {
    const query = q.trim();

    // Empty submit → random track from 抖音热榜 (discovery, no keyword needed)
    if (!query) {
      set({ searching: true, searchQuery: "", tab: "search" });
      try {
        const ensureDouyin = async (board: ChartBoardId, force = false) => {
          await get().loadCharts("douyin", force, board);
          return get().chartTracks;
        };
        let tracks = await ensureDouyin("soar");
        if (!tracks.length) tracks = await ensureDouyin("hot", true);
        if (!tracks.length) tracks = await ensureDouyin("new", true);
        if (!tracks.length) {
          set({ searching: false, searchResults: [] });
          get().showToast("热榜暂无数据，请输入关键词搜索");
          return;
        }
        const pick = tracks[Math.floor(Math.random() * tracks.length)];
        const list = tracks.map(norm).filter(Boolean) as Track[];
        set({
          searching: false,
          searchResults: list,
          queueSource: "search",
        });
        // Warm URLs for list (and siblings) while playing the random pick
        prefetchSongResolves(list, (id) => api.resolveSong(id, { level: get().preferredQuality }), {
          limit: 12,
          concurrency: 2,
        });
        get().showToast(`随机 · ${pick.name || "抖音热歌"}`);
        void get().playTrack(pick, { from: "search" });
      } catch (e: any) {
        set({ searching: false });
        get().showToast(e?.message || "随机失败，请输入关键词");
      }
      return;
    }

    set({ searching: true, searchQuery: query, tab: "search" });
    try {
      const data = await api.searchSongs(query);
      const list = data.map(norm).filter(Boolean) as Track[];
      set({
        searchResults: list,
        searching: false,
      });
      if (!data.length) get().showToast("没有结果");
      // List is ready — resolve top results in background so click/play is instant
      else {
        prefetchSongResolves(list, (id) => api.resolveSong(id, { level: get().preferredQuality }), {
          limit: 12,
          concurrency: 2,
          startDelayMs: 200,
        });
      }
    } catch (e: any) {
      set({ searching: false, searchResults: [] });
      get().showToast(e?.message || "搜索失败");
    }
  },

  setChartPlatform: (p) => {
    try {
      localStorage.setItem(CHART_KEY, p);
    } catch {
      /* */
    }
    // If platform doesn't support current board (e.g. douyin only hot), clamp
    let board = get().chartBoard;
    const meta = get().chartPlatforms.find((x) => x.id === p);
    if (meta?.boards?.length && !meta.boards.includes(board)) {
      board = meta.boards[0];
      try {
        localStorage.setItem(CHART_BOARD_KEY, board);
      } catch {
        /* */
      }
    }
    set({ chartPlatform: p, chartBoard: board, chartTracks: [] });
    void get().loadCharts(p, false, board);
  },

  setChartBoard: (b) => {
    try {
      localStorage.setItem(CHART_BOARD_KEY, b);
    } catch {
      /* */
    }
    set({ chartBoard: b, chartTracks: [] });
    void get().loadCharts(get().chartPlatform, false, b);
  },

  loadCharts: async (platform, force = false, board) => {
    const p = platform || get().chartPlatform || "douyin";
    let b = board || get().chartBoard || "soar";
    const platMeta = get().chartPlatforms.find((x) => x.id === p);
    if (platMeta?.boards?.length && !platMeta.boards.includes(b)) {
      b = platMeta.boards[0];
    }
    const flightKey = `${p}:${b}`;

    // Instant paint from browser localStorage cache
    const localHit = !force ? getCachedChart(p, b) : null;
    if (localHit?.payload?.tracks?.length) {
      set({
        chartPlatform: p,
        chartBoard: (localHit.payload.board as ChartBoardId) || b,
        chartTracks: localHit.payload.tracks.map(norm).filter(Boolean) as Track[],
        chartMetaName: localHit.payload.name || "",
        chartMetaDesc: localHit.payload.description || "",
        chartSourceLabel: localHit.payload.sourceLabel || "",
        chartUpdatedAt: localHit.payload.updatedAt || Date.now() - localHit.ageMs,
        chartLoading: localHit.stale,
      });
      prefetchCovers(localHit.payload.tracks, 40);
      prefetchSongResolves(
        localHit.payload.tracks.map(norm).filter(Boolean) as Track[], (id) => api.resolveSong(id, { level: get().preferredQuality }),
        { limit: 10, concurrency: 2, startDelayMs: 500 }
      );
      if (!localHit.stale && !force) return;
    }

    if (!force) {
      if (chartsInflight === flightKey) return;
      if (
        p === get().chartPlatform &&
        b === get().chartBoard &&
        get().chartTracks.length &&
        Date.now() - (get().chartUpdatedAt || 0) < 2 * 60 * 1000
      ) {
        return;
      }
    }
    chartsInflight = flightKey;
    if (!get().chartTracks.length || get().chartPlatform !== p || get().chartBoard !== b) {
      set({ chartLoading: true, chartPlatform: p, chartBoard: b });
    } else {
      set({ chartPlatform: p, chartBoard: b });
    }
    try {
      if (!get().chartPlatforms.length || !get().chartBoards.length) {
        const cachedPlats = getCachedPlatforms();
        if (cachedPlats?.length) set({ chartPlatforms: cachedPlats });
        try {
          const meta = await api.listChartMeta();
          if (meta.platforms?.length) {
            set({ chartPlatforms: meta.platforms });
            setCachedPlatforms(meta.platforms);
          }
          if (meta.boards?.length) set({ chartBoards: meta.boards });
        } catch {
          try {
            const plats = await api.listChartPlatforms();
            if (plats?.length) {
              set({ chartPlatforms: plats });
              setCachedPlatforms(plats);
            }
          } catch {
            /* */
          }
        }
      }
      const data = await api.fetchChart(p, { limit: 40, force, board: b });
      const tracks = (data.tracks || []).map(norm).filter(Boolean) as Track[];
      const payload = {
        ...data,
        board: (data.board as ChartBoardId) || b,
        tracks,
        updatedAt: data.updatedAt || Date.now(),
      };
      setCachedChart(payload);
      set({
        chartTracks: tracks,
        chartMetaName: data.name || "",
        chartMetaDesc: data.description || "",
        chartSourceLabel: data.sourceLabel || "",
        chartUpdatedAt: payload.updatedAt,
        chartLoading: false,
        chartPlatform: (data.platform as ChartPlatformId) || p,
        chartBoard: payload.board,
      });
      prefetchCovers(tracks, 40);
      // Pre-resolve top chart tracks so first click doesn't wait on /api/song
      prefetchSongResolves(tracks, (id) => api.resolveSong(id, { level: get().preferredQuality }), {
        limit: 10,
        concurrency: 2,
        startDelayMs: 400,
      });
      if (!tracks.length) get().showToast("热榜暂时为空");
    } catch (e: any) {
      set({ chartLoading: false });
      if (!get().chartTracks.length) get().showToast(e?.message || "热榜加载失败");
    } finally {
      if (chartsInflight === flightKey) chartsInflight = null;
    }
  },

  playTrack: async (raw, opts) => {
    const t = norm(raw);
    if (!t) return;
    const audio = get().audioEl;
    if (!audio) return;

    // Double-click / rapid re-click on same row: don't cancel an in-flight resolve
    const curId = get().curTrack?.id;
    if (get().loadingPlay && curId != null && String(curId) === String(t.id)) {
      return;
    }

    // 1) Instant cut: kill previous audio BEFORE any network
    const token = get().playToken + 1;
    hardStopAudio(audio);
    disposeWarmer(t.id); // if we were warming this as "next", drop the warmer

    // Lyrics: apply from local cache SYNCHRONOUSLY so UI never waits/re-fetches
    const cachedLyrics =
      getCachedLyric(t.id) || getCachedLyricByMeta(t.name, t.artist);
    const instantLyrics =
      cachedLyrics && (cachedLyrics.lrc || cachedLyrics.tlrc)
        ? parseLyric(cachedLyrics.lrc || "", cachedLyrics.tlrc || "")
        : [];
    // Align highlight to current position if audio already has time (rare) else -1
    const t0 = audio.currentTime || 0;
    const instantIdx =
      instantLyrics.length && t0 > 0 ? lyricIndexAt(instantLyrics, t0 * 1000) : -1;

    // UI first — search click must highlight immediately (before any await)
    stopPausedBufferPump();
    const sameTrack =
      get().curTrack != null && String(get().curTrack!.id) === String(t.id);
    set({
      playToken: token,
      playing: false,
      loadingPlay: true,
      currentTime: 0,
      duration: 0,
      buffered: 0,
      quality: "…",
      // Keep quality menu + pre-resolved URLs when only switching level on same track
      availableQualities: sameTrack ? get().availableQualities : [],
      preferredQuality: sameTrack
        ? get().preferredQuality || pickLevelForRank([], get().preferredRank)
        : pickLevelForRank([], get().preferredRank),
      playSource: "",
      lyrics: instantLyrics,
      lyricIdx: instantIdx,
      predictedNextId: null,
      curTrack: t,
    });

    // Queue source follows the list the user clicked (favorites ↔ playlist etc.)
    const qs = asQueueSource(opts?.from) || asQueueSource(get().tab) || get().queueSource;
    set({ queueSource: qs });

    // Index inside active queue; also keep playlist membership for library
    let { playlist } = get();
    let q = get().queue();
    // Recompute queue after queueSource set
    q = get().queue();
    let found = q.findIndex((x) => String(x.id) === String(t.id));
    if (found < 0 && qs === "playlist") {
      playlist = [...playlist, t];
      set({ playlist });
      found = playlist.findIndex((x) => String(x.id) === String(t.id));
      void persistSoon(get);
    } else if (found < 0 && qs !== "playlist") {
      // not in this list — still play; index 0-ish
      found = 0;
    }

    set({
      curTrack: t,
      curIdx: found,
      history: [t, ...get().history.filter((x) => String(x.id) !== String(t.id))].slice(
        0,
        200
      ),
    });
    if (t.cover) prefetchCover(t.cover, "medium");
    void persistSoon(get);

    // Intent level: rank 0 → jymaster (server falls through to best available).
    // Do NOT block first paint on full qualities probe (that was 3–6s cold).
    const rank = get().preferredRank;
    const known = get().availableQualities;
    let prefQ =
      known.length > 0
        ? pickLevelForRank(known, rank)
        : rank === 1
          ? "sky"
          : rank === 2
            ? "jyeffect"
            : DEFAULT_QUALITY;
    set({ preferredQuality: prefQ });

    // Background: probe top-3 + cache each level's CDN URL for instant quality switch
    void (async () => {
      try {
        // Reuse menu if already probed for this track
        if (sameTrack && get().availableQualities.length >= 1) {
          for (const c of get().availableQualities) {
            if (c.url) {
              setCachedSong(
                {
                  id: String(t.id),
                  url: c.url,
                  stream: `/api/stream/${encodeURIComponent(String(t.id))}?level=${encodeURIComponent(c.level)}`,
                  level: c.level,
                  br: c.br,
                  size: c.size,
                  name: t.name,
                  artist: t.artist,
                  cover: t.cover || "",
                  source: "remote",
                },
                c.level
              );
              warmMediaUrl(`${t.id}-${c.level}`, c.url);
            }
          }
          return;
        }
        const raw = await api.fetchSongQualities(t.id, 3);
        if (get().playToken !== token) return;
        const choices = normalizeChoices(raw);
        // Pre-cache every available quality URL so menu switch is instant
        for (const c of choices) {
          if (!c.url) continue;
          setCachedSong(
            {
              id: String(t.id),
              url: c.url,
              stream: `/api/stream/${encodeURIComponent(String(t.id))}?level=${encodeURIComponent(c.level)}`,
              level: c.level,
              br: c.br,
              size: c.size,
              name: t.name || "",
              artist: t.artist || "",
              cover: t.cover || "",
              source: "remote",
            },
            c.level
          );
          // Warm browser media buffer for non-current levels (low priority)
          if (c.level !== prefQ) warmMediaUrl(`${t.id}-${c.level}`, c.url);
        }
        const level = pickLevelForRank(choices, get().preferredRank);
        set({ availableQualities: choices, preferredQuality: level });
      } catch {
        /* menu stays empty; playback uses ladder fallthrough */
      }
    })();

    // Only toast when we actually need a network resolve (cache miss)
    const hadResolveCache = Boolean(
      getCachedSong(t.id, prefQ)?.url || getCachedSong(t.id, prefQ)?.stream
    );
    const slowHint = window.setTimeout(() => {
      if (get().playToken === token && get().loadingPlay && !hadResolveCache) {
        get().showToast("正在解析音源…");
      }
    }, 900);

    const stream = `/api/stream/${encodeURIComponent(String(t.id))}?level=${encodeURIComponent(prefQ)}`;
    const clearSlow = () => window.clearTimeout(slowHint);

    /** Network resolve + write durable cache (only when cache miss or forced refresh). */
    const fetchAndStoreResolve = async () => {
      const data = await api.resolveSong(t.id, { level: prefQ });
      const remoteUrl =
        data.url && /^https?:\/\//i.test(String(data.url)) ? String(data.url) : "";
      const updated = {
        ...t,
        name: data.name || t.name,
        artist: data.artist || t.artist,
        cover: data.cover || t.cover,
        level: data.level,
        br: data.br,
        size: data.size,
      };
      setCachedSong(
        {
          id: String(t.id),
          url: remoteUrl,
          stream: data.stream || stream,
          level: String(data.level || prefQ),
          br: Number(data.br || 0),
          size: Number(data.size || 0),
          name: updated.name,
          artist: updated.artist,
          cover: updated.cover || "",
          source: String(data.source || ""),
          play: data.play,
        },
        prefQ
      );
      return { data, remoteUrl, updated };
    };

    /** Play a URL; on media error, re-resolve once then stream fallback. */
    const playRemoteOrStream = async (
      remoteUrl: string,
      fromCache: boolean
    ): Promise<boolean> => {
      const tryPlay = async (src: string, sourceLabel: string) => {
        applyAudioVolume(audio, get().volume, get().muted);
        audio.src = src;
        await audio.play();
        if (get().playToken !== token) return false;
        set({ playing: true, loadingPlay: false, playSource: sourceLabel });
        // Late decode/CDN errors after play() resolves → refresh once
        if (sourceLabel === "remote") {
          const onErr = () => {
            if (get().playToken !== token) return;
            audio.removeEventListener("error", onErr);
            void (async () => {
              try {
                invalidateCachedSong(t.id, prefQ);
                const fresh = await fetchAndStoreResolve();
                if (get().playToken !== token) return;
                if (fresh.remoteUrl) {
                  audio.src = fresh.remoteUrl;
                  set({
                    curTrack: fresh.updated,
                    quality: String(fresh.data.level || ""),
                    playSource: "remote",
                  });
                  await audio.play();
                } else {
                  set({ playSource: "stream" });
                  audio.src = stream;
                  await audio.play();
                }
              } catch {
                try {
                  set({ playSource: "stream" });
                  audio.src = stream;
                  await audio.play();
                } catch {
                  /* */
                }
              }
            })();
          };
          audio.addEventListener("error", onErr, { once: true });
        }
        return true;
      };

      try {
        if (remoteUrl) {
          if (await tryPlay(remoteUrl, "remote")) return true;
        }
      } catch {
        /* try refresh / stream */
      }

      // Cached CDN link often expires — re-resolve once, then stream
      if (fromCache || remoteUrl) {
        try {
          invalidateCachedSong(t.id, prefQ);
          const fresh = await fetchAndStoreResolve();
          if (get().playToken !== token) return false;
          set({
            curTrack: fresh.updated,
            quality: String(fresh.data.level || get().quality || ""),
          });
          if (fresh.remoteUrl) {
            try {
              if (await tryPlay(fresh.remoteUrl, "remote")) return true;
            } catch {
              /* stream next */
            }
          }
        } catch {
          /* stream next */
        }
      }

      try {
        set({ playSource: "stream" });
        if (await tryPlay(stream, "stream")) return true;
      } catch {
        /* */
      }
      return false;
    };

    // 2a) Offline blob (favorites previously cached) — instant
    let playedFromBlob = false;
    let remote = "";
    let meta: any = null;
    const songCached = getCachedSong(t.id, prefQ);

    try {
      const blobUrl = await getAudioObjectURL(t.id);
      if (get().playToken !== token) {
        clearSlow();
        return;
      }
      if (blobUrl) {
        const cachedMeta = getCachedSong(t.id, prefQ) || songCached;
        if (cachedMeta) {
          set({
            curTrack: {
              ...t,
              name: cachedMeta.name || t.name,
              artist: cachedMeta.artist || t.artist,
              cover: cachedMeta.cover || t.cover,
              level: cachedMeta.level,
              br: cachedMeta.br,
              size: cachedMeta.size,
            },
            quality: cachedMeta.level || "缓存",
            playSource: "cache",
          });
        } else {
          set({ quality: "缓存", playSource: "cache" });
        }
        try {
          audio.src = blobUrl;
          applyAudioVolume(audio, get().volume, get().muted);
          await audio.play();
          if (get().playToken !== token) {
            clearSlow();
            return;
          }
          set({ playing: true, loadingPlay: false });
          playedFromBlob = true;
          clearSlow();
        } catch {
          playedFromBlob = false;
        }
      }
    } catch {
      /* idb unavailable */
    }

    // 2b) Pre-resolved cache → play URL immediately (NO /api/song)
    //     Cache miss → resolve once, store, play
    //     Play error → re-resolve then stream (see playRemoteOrStream)
    if (!playedFromBlob) {
      if (songCached && (songCached.url || songCached.stream)) {
        remote =
          songCached.url && /^https?:\/\//i.test(songCached.url) ? songCached.url : "";
        meta = songCached;
        set({
          curTrack: {
            ...t,
            name: songCached.name || t.name,
            artist: songCached.artist || t.artist,
            cover: songCached.cover || t.cover,
            level: songCached.level,
            br: songCached.br,
            size: songCached.size,
          },
          quality: songCached.level || "",
          playSource: remote ? "remote" : "stream",
        });
        const ok = await playRemoteOrStream(remote, true);
        if (get().playToken !== token) {
          clearSlow();
          return;
        }
        if (!ok) {
          clearSlow();
          set({ loadingPlay: false });
          get().showToast("无法播放");
        } else {
          clearSlow();
        }
      } else {
        try {
          const fresh = await fetchAndStoreResolve();
          if (get().playToken !== token) {
            clearSlow();
            return;
          }
          remote = fresh.remoteUrl;
          meta = fresh.data;
          set({
            curTrack: fresh.updated,
            quality: String(fresh.data.level || ""),
            playSource:
              fresh.data.play?.mode ||
              fresh.data.source ||
              (remote ? "remote" : "stream"),
          });
          const ok = await playRemoteOrStream(remote, false);
          if (get().playToken !== token) {
            clearSlow();
            return;
          }
          if (!ok) {
            clearSlow();
            set({ loadingPlay: false });
            get().showToast("点击播放或按空格键开始");
          } else {
            clearSlow();
          }
        } catch (e: any) {
          if (get().playToken !== token) {
            clearSlow();
            return;
          }
          clearSlow();
          set({ loadingPlay: false });
          get().showToast(e?.message || "无法播放");
        }
      }
    } else {
      clearSlow();
    }

    // Lyrics: cache hit already applied above — skip network entirely.
    // Only fetch when miss; then write durable cache for next time.
    if (!cachedLyrics || !(cachedLyrics.lrc || cachedLyrics.tlrc)) {
      void (async () => {
        try {
          const cur = get().curTrack || t;
          const lyr = await api.fetchLyric(t.id, {
            name: cur.name || t.name,
            artist: cur.artist || t.artist,
            duration: Number(cur.duration || t.duration || 0) || undefined,
          });
          if (get().playToken !== token) return;
          const lrc = lyr.lrc || "";
          const tlrc = lyr.tlrc || "";
          if (lrc || tlrc) {
            const lines = parseLyric(lrc, tlrc);
            const a = get().audioEl;
            const pos = (a?.currentTime || 0) * 1000;
            set({
              lyrics: lines,
              lyricIdx: lyricIndexAt(lines, pos),
            });
            setCachedLyric(t.id, {
              lrc,
              tlrc,
              source: lyr.source,
              name: cur.name || t.name,
              artist: cur.artist || t.artist,
            });
            if (lyr.matchedId && String(lyr.matchedId) !== String(t.id)) {
              setCachedLyric(lyr.matchedId, {
                lrc,
                tlrc,
                source: lyr.source,
                name: cur.name || t.name,
                artist: cur.artist || t.artist,
              });
            }
          } else {
            set({ lyrics: [], lyricIdx: -1 });
          }
        } catch {
          if (get().playToken === token && !get().lyrics.length) {
            set({ lyrics: [], lyricIdx: -1 });
          }
        }
      })();
    }

    // Persist favorite / current track audio to IDB for instant re-play
    const isFav = get().isFavorite(t.id);
    if (isFav || get().queueSource === "favorites") {
      void cacheAudioFromStream(t.id, { level: String(meta?.level || get().quality || "") });
    }

    // Predict + warm next track (resolve + audio advance)
    get().recomputePredictedNext();
    get().prefetchAround(t.id);
  },

  togglePlay: () => {
    const audio = get().audioEl;
    if (!audio) return;
    const cur = get().curTrack;
    // No media yet (home preselect / after hardStop) → start selected or first in queue
    if (!audio.src || !audio.currentSrc) {
      const q = get().queue();
      if (cur) void get().playTrack(cur, { from: get().queueSource });
      else if (q.length) void get().playTrack(q[0], { from: get().queueSource });
      return;
    }
    if (audio.paused) {
      // Home warm already put the right src on the real player → just play (no re-resolve)
      const warmOk = cur && audio.dataset.warmFor === String(cur.id);
      void audio
        .play()
        .then(() => {
          set({ playing: true, loadingPlay: false });
          if (warmOk && cur) {
            // Same post-play work as playTrack (next warm stays unchanged)
            get().recomputePredictedNext();
            get().prefetchAround(cur.id);
            if (get().isFavorite(cur.id) || get().queueSource === "favorites") {
              void cacheAudioFromStream(cur.id, {
                level: String(get().quality || ""),
              });
            }
          }
        })
        .catch(() => {
          const t = get().curTrack;
          if (t) void get().playTrack(t, { from: get().queueSource });
        });
    } else {
      audio.pause();
      set({ playing: false });
    }
  },

  /**
   * Pre-resolve + buffer the home pick on the REAL <audio> (not only a hidden warmer).
   * Space/play then is just audio.play() — same snappiness as switching to a prefetched next.
   * Does NOT replace prefetchAround for neighbors.
   */
  warmTrack: (raw) => {
    const t = norm(raw);
    if (!t) return;

    void (async () => {
      let remote = "";
      let level = "";
      // Warm uses best-effort preferred; full probe happens on real play
      const prefQ = get().preferredQuality || DEFAULT_QUALITY;
      const stream = `/api/stream/${encodeURIComponent(String(t.id))}?level=${encodeURIComponent(prefQ)}`;
      const cached = getCachedSong(t.id, prefQ);
      if (cached && (cached.url || cached.stream)) {
        remote = cached.url && /^https?:\/\//i.test(cached.url) ? cached.url : "";
        level = cached.level || "";
        if (get().curTrack && String(get().curTrack!.id) === String(t.id) && !get().playing) {
          set({
            curTrack: {
              ...get().curTrack!,
              name: cached.name || get().curTrack!.name,
              artist: cached.artist || get().curTrack!.artist,
              cover: cached.cover || get().curTrack!.cover,
              level: cached.level || get().curTrack!.level,
              br: cached.br || get().curTrack!.br,
              size: cached.size || get().curTrack!.size,
            },
            quality: level || get().quality || "…",
            playSource: remote ? "remote" : "stream",
          });
        }
      } else {
        try {
          const meta = await api.resolveSong(t.id, { level: prefQ });
          // Abort if user already switched away
          if (get().curTrack && String(get().curTrack!.id) !== String(t.id)) return;
          remote =
            meta.url && /^https?:\/\//i.test(meta.url) ? String(meta.url) : "";
          level = String(meta.level || "");
          const updated = {
            ...(get().curTrack && String(get().curTrack!.id) === String(t.id)
              ? get().curTrack!
              : t),
            name: meta.name || t.name,
            artist: meta.artist || t.artist,
            cover: meta.cover || t.cover,
            level: meta.level,
            br: meta.br,
            size: meta.size,
          };
          setCachedSong({
            id: String(t.id),
            url: remote,
            stream: meta.stream || stream,
            level,
            br: Number(meta.br || 0),
            size: Number(meta.size || 0),
            name: updated.name,
            artist: updated.artist,
            cover: updated.cover || "",
            source: String(meta.source || ""),
            play: meta.play,
          }, prefQ);
          if (
            get().curTrack &&
            String(get().curTrack!.id) === String(t.id) &&
            !get().playing
          ) {
            set({
              curTrack: updated,
              quality: level || "…",
              playSource: remote ? "remote" : "stream",
            });
          }
        } catch {
          return;
        }
      }

      if (get().playing) return;
      if (!get().curTrack || String(get().curTrack!.id) !== String(t.id)) return;

      // Prefer durable blob (favorites re-visit) → CDN → stream proxy
      let playUrl = remote || stream;
      let fromBlob = false;
      try {
        const blobUrl = await getAudioObjectURL(t.id);
        if (blobUrl && !get().playing && String(get().curTrack?.id) === String(t.id)) {
          playUrl = blobUrl;
          fromBlob = true;
          set({ playSource: "cache", quality: level || "缓存" });
        }
      } catch {
        /* */
      }

      // Load onto the actual player element (hidden warmer alone doesn't help Space)
      const audio = get().audioEl;
      if (audio && !get().playing && String(get().curTrack?.id) === String(t.id)) {
        try {
          if (audio.dataset.warmFor !== String(t.id) || !audio.src) {
            audio.preload = "auto";
            audio.src = playUrl;
            audio.dataset.warmFor = String(t.id);
            applyAudioVolume(audio, get().volume, get().muted);
            audio.load();
          }
        } catch {
          /* */
        }
      } else if (!fromBlob) {
        // audio not mounted yet — keep hidden warmer as fallback
        warmMediaUrl(t.id, remote || stream);
      }

      // Lyrics into cache; apply to UI if still selected and empty
      const applyLyricsIfNeeded = () => {
        if (!get().curTrack || String(get().curTrack!.id) !== String(t.id)) return;
        if (get().lyrics.length) return;
        const hit =
          getCachedLyric(t.id) || getCachedLyricByMeta(t.name, t.artist);
        if (hit && (hit.lrc || hit.tlrc)) {
          set({
            lyrics: parseLyric(hit.lrc || "", hit.tlrc || ""),
            lyricIdx: -1,
          });
        }
      };
      applyLyricsIfNeeded();
      prefetchLyric(
        t.id,
        {
          name: t.name,
          artist: t.artist,
          duration: Number(t.duration || 0) || undefined,
        },
        (id, o) => api.fetchLyric(id, o)
      );
      setTimeout(applyLyricsIfNeeded, 1200);
      setTimeout(applyLyricsIfNeeded, 3500);
    })();
  },

  next: (delta = 1) => {
    const q = get().queue();
    if (!q.length) return;
    const cur = get().curTrack
      ? q.findIndex((x) => String(x.id) === String(get().curTrack!.id))
      : -1;

    // Prefer sticky predicted next (matches what we prefetched)
    if (delta === 1 && get().playMode !== "single") {
      const pred = get().predictedNextId;
      if (pred) {
        const hit = q.find((x) => String(x.id) === String(pred));
        if (hit) {
          set({ predictedNextId: null });
          void get().playTrack(hit, { from: get().queueSource });
          return;
        }
      }
    }

    const idx = nextQueueIndex(cur, q.length, get().playMode, delta);
    if (idx >= 0) void get().playTrack(q[idx], { from: get().queueSource });
  },

  seek: (ratio) => {
    const audio = get().audioEl;
    if (!audio || !audio.duration) return;
    audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
    set({ currentTime: audio.currentTime });
  },

  seekBy: (deltaSec) => {
    const audio = get().audioEl;
    if (!audio) return;
    const next = clampSeek(audio.currentTime || 0, deltaSec, audio.duration || 0);
    audio.currentTime = next;
    set({ currentTime: next });
  },

  setVolume: (v) => {
    const volume = clampVolume(v);
    // dragging to 0 implies mute; raising volume unmutes
    const muted = volume <= 0;
    try {
      localStorage.setItem(VOL_KEY, String(volume <= 0 ? get().volume || 0.6 : volume));
      // keep last non-zero volume when sliding to 0
      if (volume > 0) localStorage.setItem(VOL_KEY, String(volume));
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* */
    }
    const storeVol = volume > 0 ? volume : get().volume || 0.6;
    applyAudioVolume(get().audioEl, storeVol, muted);
    set({ volume: storeVol, muted });
  },

  toggleMute: () => {
    const muted = !get().muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      /* */
    }
    applyAudioVolume(get().audioEl, get().volume, muted);
    set({ muted });
    get().showToast(muted ? "已静音" : "取消静音");
  },

  tick: () => {
    const audio = get().audioEl;
    if (!audio) return;
    // Never shrink buffer within a track (paused pump may be ahead of main)
    const buf = Math.max(bufferedRatio(audio), get().buffered);
    if (!get().seeking) {
      set({
        currentTime: audio.currentTime || 0,
        duration: audio.duration || 0,
        buffered: buf,
        playing: !audio.paused && !!audio.src,
      });
    } else if (Math.abs(buf - get().buffered) > 0.005) {
      set({ buffered: buf });
    }
    const idx = lyricIndexAt(get().lyrics, (audio.currentTime || 0) * 1000);
    if (idx !== get().lyricIdx) set({ lyricIdx: idx });
  },

  reportBuffered: (ratio) => {
    const r = Math.max(0, Math.min(1, ratio));
    if (r > get().buffered + 0.004) set({ buffered: r });
  },

  onPlayerPause: () => {
    const audio = get().audioEl;
    const cur = get().curTrack;
    if (!audio || !cur) return;
    const src = audio.currentSrc || audio.src || "";
    if (!src) return;
    // Browser often freezes main element network on pause — keep filling via pump
    startPausedBufferPump({
      trackId: cur.id,
      src,
      mainAudio: audio,
      level: String(get().quality || get().preferredQuality || ""),
      onProgress: (p) => get().reportBuffered(p.ratio),
    });
  },

  onPlayerPlay: () => {
    stopPausedBufferPump();
    // Re-sync from main element after resume (HTTP cache may already be warm)
    get().tick();
  },

  setPreferredRank: (rank) => {
    const r = (rank === 1 || rank === 2 ? rank : 0) as QualityRank;
    savePreferredRank(r);
    const choices = get().availableQualities;
    const level = pickLevelForRank(choices, r);
    set({ preferredRank: r, preferredQuality: level });
    const lab = labelForLevel(level);
    get().showToast(`音质：${lab.label}`);
    const cur = get().curTrack;
    if (cur) {
      void get().playTrack(cur, { from: get().queueSource });
    }
  },

  cyclePreferredQuality: () => {
    const n = get().availableQualities.length || 3;
    const next = cycleRank(get().preferredRank, n);
    get().setPreferredRank(next);
  },

  setQualityLevel: (level) => {
    const lv = String(level || "").trim();
    if (!lv) return;
    const cur = get().curTrack;
    if (!cur) return;
    const choices = get().availableQualities;
    const idx = choices.findIndex((c) => c.level === lv);
    const rank = (idx >= 0 ? Math.min(2, idx) : 0) as QualityRank;
    savePreferredRank(rank);
    set({ preferredRank: rank, preferredQuality: lv });
    const lab = labelForLevel(lv);
    get().showToast(`音质：${lab.label}`);

    // Instant path: use pre-probed / pre-cached URL — no network wait
    const choice = idx >= 0 ? choices[idx] : null;
    const cached = getCachedSong(cur.id, lv);
    const remote =
      (choice?.url && /^https?:\/\//i.test(choice.url) ? choice.url : "") ||
      (cached?.url && /^https?:\/\//i.test(cached.url) ? cached.url : "");
    const audio = get().audioEl;
    if (remote && audio) {
      stopPausedBufferPump();
      const token = get().playToken + 1;
      const t = {
        ...cur,
        level: lv,
        br: choice?.br || cached?.br || cur.br || 0,
        size: choice?.size || cached?.size || cur.size || 0,
      };
      set({
        playToken: token,
        curTrack: t,
        quality: lv,
        preferredQuality: lv,
        loadingPlay: true,
        buffered: 0,
        currentTime: 0,
        playSource: "",
      });
      void (async () => {
        try {
          hardStopAudio(audio);
          applyAudioVolume(audio, get().volume, get().muted);
          audio.src = remote;
          await audio.play();
          if (get().playToken !== token) return;
          set({
            playing: true,
            loadingPlay: false,
            playSource: "remote",
            quality: lv,
          });
          get().recomputePredictedNext();
          get().prefetchAround(t.id);
        } catch {
          // Fallback to full play path (re-resolve)
          if (get().playToken === token) {
            void get().playTrack(t, { from: get().queueSource });
          }
        }
      })();
      return;
    }
    // No pre-cached URL — full resolve path
    void get().playTrack(cur, { from: get().queueSource });
  },

  cycleMode: () => {
    const m = cyclePlayMode(get().playMode);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* */
    }
    set({ playMode: m, predictedNextId: null });
    get().showToast(playModeLabel(m));
    // Mode change → re-pick next and re-warm
    if (get().curTrack) {
      get().recomputePredictedNext();
      get().prefetchAround(get().curTrack!.id);
    }
  },

  recomputePredictedNext: () => {
    const q = get().queue();
    if (!q.length) {
      set({ predictedNextId: null });
      return;
    }
    const cur = get().curTrack
      ? q.findIndex((x) => String(x.id) === String(get().curTrack!.id))
      : -1;
    const idx = predictNextIndex(cur, q.length, get().playMode);
    if (idx < 0 || !q[idx]) {
      set({ predictedNextId: null });
      return;
    }
    set({ predictedNextId: String(q[idx].id) });
  },

  /**
   * Advance cache while current song plays:
   * 1) Resolve URL for predicted next (+ prev / list +2)
   * 2) Warm media buffer (hidden Audio) for remote URL
   * 3) Download full blob for favorites / predicted next (IDB)
   */
  prefetchAround: (id) => {
    const q = get().queue();
    const i = q.findIndex((x) => String(x.id) === String(id));
    if (i < 0 && !get().predictedNextId) return;

    const targets: Track[] = [];
    const seen = new Set<string>();
    const push = (t?: Track | null) => {
      if (!t || t.id == null) return;
      const k = String(t.id);
      if (k === String(id) || seen.has(k)) return;
      seen.add(k);
      targets.push(t);
    };

    // Primary: sticky predicted next (list order OR pre-picked shuffle)
    const predId = get().predictedNextId;
    if (predId) {
      push(q.find((x) => String(x.id) === String(predId)) || null);
    }

    // Secondary neighbors for list mode / prev button
    if (i >= 0) {
      push(q[i + 1]);
      push(q[i - 1]);
      if (get().playMode === "list") push(q[i + 2]);
    }

    // Cap concurrent advance work
    const list = targets.slice(0, 3);
    const favSet = new Set(get().favorites.map((f) => String(f.id)));
    const preferBlob = get().queueSource === "favorites";

    for (const n of list) {
      const isPrimary = predId != null && String(n.id) === String(predId);
      const shouldBlob = preferBlob || favSet.has(String(n.id)) || isPrimary;

      // Cover first — thumb for list paint (cheap)
      if (n.cover) prefetchCover(n.cover, "thumb");

      // Primary next: pre-probe all top-3 quality URLs so quality switch is warm
      if (isPrimary) {
        void (async () => {
          try {
            const raw = await api.fetchSongQualities(n.id, 3);
            const choices = normalizeChoices(raw);
            for (const c of choices) {
              if (!c.url) continue;
              setCachedSong(
                {
                  id: String(n.id),
                  url: c.url,
                  stream: `/api/stream/${encodeURIComponent(String(n.id))}?level=${encodeURIComponent(c.level)}`,
                  level: c.level,
                  br: c.br,
                  size: c.size,
                  name: n.name || "",
                  artist: n.artist || "",
                  cover: n.cover || "",
                  source: "remote",
                },
                c.level
              );
              warmMediaUrl(`${n.id}-${c.level}`, c.url);
            }
          } catch {
            /* */
          }
        })();
      }

      void (async () => {
        // Resolve meta if missing
        let remote = "";
        let level = "";
        const cached = getCachedSong(n.id, get().preferredQuality);
        if (cached && (cached.url || cached.stream)) {
          remote = cached.url && /^https?:\/\//i.test(cached.url) ? cached.url : "";
          level = cached.level || "";
        } else {
          try {
            const meta = await api.resolveSong(n.id, { level: get().preferredQuality });
            remote =
              meta.url && /^https?:\/\//i.test(meta.url) ? String(meta.url) : "";
            level = String(meta.level || "");
            setCachedSong({
              id: String(n.id),
              url: remote,
              stream: meta.stream || `/api/stream/${n.id}`,
              level,
              br: Number(meta.br || 0),
              size: Number(meta.size || 0),
              name: meta.name || n.name,
              artist: meta.artist || n.artist,
              cover: meta.cover || n.cover || "",
              source: String(meta.source || ""),
              play: meta.play,
            }, get().preferredQuality);
            if (meta.cover) prefetchCover(String(meta.cover), "thumb");
          } catch {
            return;
          }
        }

        // Layer 1: warm browser media cache (CDN remote or stream)
        const warmUrl = remote || `/api/stream/${encodeURIComponent(String(n.id))}`;
        warmMediaUrl(n.id, warmUrl);

        // Layer 2: durable blob for snappy next / offline-ish re-play
        if (shouldBlob) {
          const already = await hasAudioBlob(n.id);
          if (!already) {
            // slight stagger so current stream isn't starved on mobile
            const delay = isPrimary ? 400 : 1200;
            await new Promise((r) => setTimeout(r, delay));
            // abort if user already switched away to something else entirely
            if (get().curTrack && String(get().curTrack!.id) === String(n.id)) return;
            await cacheAudioFromStream(n.id, { level });
          }
        }

        // Layer 3: prefetch lyrics for next/prev (all neighbors, not only primary)
        prefetchLyric(
          n.id,
          {
            name: n.name,
            artist: n.artist,
            duration: Number(n.duration || 0) || undefined,
          },
          (id, o) => api.fetchLyric(id, o)
        );
      })();
    }
  },

  toggleFavorite: (t) => {
    const track = norm(t || get().curTrack);
    if (!track) return;
    let favorites = get().favorites;
    const has = favorites.some((x) => String(x.id) === String(track.id));
    if (has) {
      favorites = favorites.filter((x) => String(x.id) !== String(track.id));
      get().showToast(`已取消收藏: ${track.name}`);
      set({ favorites });
      void api
        .deleteFromList("favorites", track.id)
        .then(applyLib(set))
        .catch(() => persistSoon(get, { forceClearFavorites: !favorites.length }));
    } else {
      favorites = [track, ...favorites.filter((x) => String(x.id) !== String(track.id))].slice(
        0,
        500
      );
      get().showToast(`已收藏: ${track.name}`);
      set({ favorites });
      void persistSoon(get);
      // Eagerly cache newly favorited track audio
      void cacheAudioFromStream(track.id, { level: String(track.level || "") });
    }
  },

  addToPlaylist: (t) => {
    const track = norm(t);
    if (!track) return;
    if (get().playlist.some((x) => String(x.id) === String(track.id))) {
      get().showToast("已在列表中");
      return;
    }
    set({ playlist: [...get().playlist, track] });
    get().showToast(`+ ${track.name}`);
    void persistSoon(get);
  },

  removeFromPlaylist: (id) => {
    const playlist = get().playlist.filter((x) => String(x.id) !== String(id));
    set({ playlist });
    void api
      .deleteFromList("playlist", id)
      .then(applyLib(set))
      .catch(() => persistSoon(get, { forceClearPlaylist: !playlist.length }));
  },

  removeFromHistory: (id) => {
    const history = get().history.filter((x) => String(x.id) !== String(id));
    set({ history });
    get().showToast("已从历史移除");
    void api
      .deleteFromList("history", id)
      .then(applyLib(set))
      .catch(() => persistSoon(get, { forceClearHistory: !history.length }));
  },
}));

function applyLib(set: (p: Partial<State>) => void) {
  return (lib: Library) => {
    set({
      playlist: (lib.playlist || []).map(norm).filter(Boolean) as Track[],
      favorites: (lib.favorites || []).map(norm).filter(Boolean) as Track[],
      history: (lib.history || []).map(norm).filter(Boolean) as Track[],
      curIdx: lib.curIdx ?? -1,
    });
  };
}

/** Prevents double-fetch when setTab + ChartsPanel mount both call loadCharts */
let chartsInflight: string | null = null;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persistSoon(get: () => State, force: Record<string, boolean> = {}) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const s = get();
    const payload = {
      playlist: s.playlist,
      favorites: s.favorites,
      history: s.history,
      curIdx: s.curIdx,
      ...force,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {
      /* */
    }
    try {
      const lib = await api.saveLibrary(payload);
      applyLib(usePlayer.setState)(lib);
    } catch {
      /* offline ok */
    }
  }, 220);
}
