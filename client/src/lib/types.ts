export type Track = {
  id: string | number;
  name: string;
  artist: string;
  album?: string;
  cover?: string;
  duration?: number;
  level?: string;
  br?: number;
  size?: number;
  /** 热榜名次 1-based */
  rank?: number;
};

export type ChartPlatformId =
  | "douyin"
  | "network"
  | "netease"
  | "qq"
  | "kugou"
  | "kuwo"
  | "index"
  | "original";
/** soar=飙升(更热) hot=热歌 new=新歌 */
export type ChartBoardId = "soar" | "hot" | "new";

export type ChartPlatform = {
  id: ChartPlatformId;
  name: string;
  short: string;
  description: string;
  boards?: ChartBoardId[];
};

export type ChartBoard = {
  id: ChartBoardId;
  name: string;
  short: string;
  description: string;
};

export type ChartPayload = {
  platform: ChartPlatformId;
  board?: ChartBoardId;
  name: string;
  description: string;
  sourceLabel?: string;
  updatedAt: number;
  tracks: Track[];
};

export type Library = {
  playlist: Track[];
  favorites: Track[];
  history: Track[];
  curIdx: number;
  /** Optimistic concurrency token from D1 (monotone). */
  revision?: number;
};

export type PlayMode = "list" | "single" | "shuffle";
export type PanelTab =
  | "search"
  | "charts"
  | "playlist"
  | "favorites"
  | "history"
  | "lyrics";
export type QueueSource =
  | "playlist"
  | "favorites"
  | "history"
  | "search"
  | "charts";
export type LyricLine = { ms: number; orig: string; tran: string };

export type {
  SkinId,
  SkinLayout,
  ThemeTokens,
} from "../skins/theme-catalog";
export {
  THEME_CATALOG,
  getTheme,
  themeToCssVars,
} from "../skins/theme-catalog";

import {
  THEME_CATALOG,
  getTheme,
  type SkinId,
} from "../skins/theme-catalog";

/** Alias for switcher UI */
export const SKINS = THEME_CATALOG.map((t) => ({
  id: t.id as SkinId,
  name: t.name,
  nameEn: t.nameEn,
  tagline: t.tagline,
  taglineEn: t.taglineEn,
  accent: t.accent,
  themeColor: t.themeColor,
  layout: t.layout,
}));

export const DEFAULT_SKIN: SkinId = "aurora";

/** Localized theme name / tagline for UI */
export function themeDisplayName(
  t: { name: string; nameEn?: string; id?: string },
  locale: string
): string {
  if (locale === "en") return t.nameEn || t.id || t.name;
  return t.name;
}

export function themeDisplayTagline(
  t: { tagline: string; taglineEn?: string },
  locale: string
): string {
  if (locale === "en") return t.taglineEn || t.tagline;
  return t.tagline;
}

export function skinMeta(id: SkinId | string) {
  const t = getTheme(id);
  return {
    id: t.id as SkinId,
    name: t.name,
    nameEn: t.nameEn,
    tagline: t.tagline,
    taglineEn: t.taglineEn,
    accent: t.accent,
    themeColor: t.themeColor,
    layout: t.layout,
  };
}
