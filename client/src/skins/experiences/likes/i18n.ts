import type { Locale } from "../../../i18n";

export const likesI18n = {
  zh: {
    brandMark: "匣",
    homeTitle: "收藏",
    homeBlurb: "点哪首播哪首",
    count: "{n} 首",
    navAria: "收藏导航",
    dest: {
      favorites: "收藏",
      search: "搜索",
      history: "历史",
      charts: "榜单",
      lyrics: "歌词",
      playlist: "列表",
    },
    palette: {
      aria: "匣的配色",
      dim: "雾",
      deep: "绛",
      dimTitle: "雾 · 灰粉绒面",
      deepTitle: "绛 · 墨底绛红",
    },
    miniAria: "迷你播放条",
    openTransport: "打开播放控制",
    closeSheet: "收起播放控制",
    searchLaunch: "搜索",
    paletteSwitch: "配色",
  },
  en: {
    brandMark: "Keep",
    homeTitle: "Likes",
    homeBlurb: "Tap a row to play it",
    count: "{n} tracks",
    navAria: "Likes navigation",
    dest: {
      favorites: "Likes",
      search: "Search",
      history: "History",
      charts: "Charts",
      lyrics: "Lyrics",
      playlist: "Queue",
    },
    palette: {
      aria: "Keep palettes",
      dim: "Dim",
      deep: "Deep",
      dimTitle: "Dim · dusty rose velvet",
      deepTitle: "Deep · garnet on ink",
    },
    miniAria: "Mini player",
    openTransport: "Open playback controls",
    closeSheet: "Close playback controls",
    searchLaunch: "Search",
    paletteSwitch: "Palette",
  },
} as const;

type LikesLeaf = string | { [k: string]: LikesLeaf };

function lookup(dict: LikesLeaf, key: string): string | undefined {
  const parts = key.split(".");
  let cur: LikesLeaf | undefined = dict;
  for (const p of parts) {
    if (cur == null || typeof cur === "string") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function likesT(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  let s =
    lookup(likesI18n[locale], key) ??
    (locale !== "zh" ? lookup(likesI18n.zh, key) : undefined) ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
