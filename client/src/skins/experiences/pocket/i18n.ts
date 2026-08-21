import type { Locale } from "../../../i18n";

export const pocketI18n = {
  zh: {
    mark: "袋",
    nowAria: "正在播放",
    libraryAria: "曲库",
    tabsAria: "袋导航",
    facesAria: "封面或歌词",
    faceCover: "封面",
    faceLyrics: "歌词",
    flipHint: "点封面看歌词 · 封面页上下滑切歌",
    lineHint: "点这句打开全部歌词",
    backCover: "回到封面",
    openNow: "回到正在播放",
    miniAria: "迷你播放条",
    searchLaunch: "搜索歌曲",
    paletteAria: "袋的配色",
    paper: "纸",
    ink: "墨",
    paperTitle: "纸 · 宣纸浅底",
    inkTitle: "墨 · 墨底金线",
    tab: {
      now: "播放",
      playlist: "列表",
      favorites: "收藏",
      charts: "榜单",
      history: "历史",
    },
  },
  en: {
    mark: "Pocket",
    nowAria: "Now playing",
    libraryAria: "Library",
    tabsAria: "Pocket navigation",
    facesAria: "Cover or lyrics",
    faceCover: "Cover",
    faceLyrics: "Lyrics",
    flipHint: "Tap the cover for lyrics · swipe the page up or down to change tracks",
    lineHint: "Tap this line for all lyrics",
    backCover: "Back to cover",
    openNow: "Back to now playing",
    miniAria: "Mini player",
    searchLaunch: "Search tracks",
    paletteAria: "Pocket palettes",
    paper: "Paper",
    ink: "Ink",
    paperTitle: "Paper · rice-paper light",
    inkTitle: "Ink · gold on black",
    tab: {
      now: "Now",
      playlist: "Queue",
      favorites: "Liked",
      charts: "Charts",
      history: "History",
    },
  },
} as const;

type PocketLeaf = string | { [k: string]: PocketLeaf };

function lookup(dict: PocketLeaf, key: string): string | undefined {
  const parts = key.split(".");
  let cur: PocketLeaf | undefined = dict;
  for (const p of parts) {
    if (cur == null || typeof cur === "string") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function pocketT(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  let s =
    lookup(pocketI18n[locale], key) ??
    (locale !== "zh" ? lookup(pocketI18n.zh, key) : undefined) ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
