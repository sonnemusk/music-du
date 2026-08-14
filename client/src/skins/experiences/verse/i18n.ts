import type { Locale } from "../../../i18n";

type VerseDict = {
  keysAria: string;
  sheetAria: string;
  closeSheet: string;
  searchLaunch: string;
  dockAria: string;
  controlsAria: string;
  leafSearch: string;
  leafCharts: string;
  leafPlaylist: string;
  leafFavorites: string;
  leafHistory: string;
  leafLyrics: string;
  glyphLyrics: string;
  glyphSearch: string;
  glyphCharts: string;
  glyphPlaylist: string;
  glyphFavorites: string;
  glyphHistory: string;
};

export const verseI18n: Record<Locale, VerseDict> = {
  zh: {
    keysAria: "词页目录",
    sheetAria: "曲库面板",
    closeSheet: "回到歌词",
    searchLaunch: "搜索歌曲",
    dockAria: "迷你播放条",
    controlsAria: "上一首、播放、下一首",
    leafSearch: "搜索",
    leafCharts: "热榜",
    leafPlaylist: "列表",
    leafFavorites: "收藏",
    leafHistory: "历史",
    leafLyrics: "歌词",
    glyphLyrics: "词",
    glyphSearch: "搜",
    glyphCharts: "榜",
    glyphPlaylist: "列",
    glyphFavorites: "藏",
    glyphHistory: "史",
  },
  en: {
    keysAria: "Verse index",
    sheetAria: "Library panel",
    closeSheet: "Back to lyrics",
    searchLaunch: "Search tracks",
    dockAria: "Mini player",
    controlsAria: "Previous, play, next",
    leafSearch: "Search",
    leafCharts: "Charts",
    leafPlaylist: "Queue",
    leafFavorites: "Liked",
    leafHistory: "History",
    leafLyrics: "Lyrics",
    glyphLyrics: "Ly",
    glyphSearch: "S",
    glyphCharts: "♪",
    glyphPlaylist: "Q",
    glyphFavorites: "♥",
    glyphHistory: "H",
  },
};

export type VerseI18nKey = keyof VerseDict;

export function verseT(locale: Locale, key: VerseI18nKey): string {
  return verseI18n[locale]?.[key] ?? verseI18n.zh[key] ?? key;
}
