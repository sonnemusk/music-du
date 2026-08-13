import { useMemo } from "react";
import type { Locale } from "../../../i18n";

export const boardsDict = {
  zh: {
    kicker: "本站多平台热榜",
    wordmark: "榜单",
    destAria: "内容分区",
    searchLaunch: "搜索",
    nowEmpty: "点一首榜单歌曲开始播放",
    ticker: "正在播放",
    openLyrics: "打开歌词",
  },
  en: {
    kicker: "Live multi-platform charts",
    wordmark: "BOARDS",
    destAria: "Library sections",
    searchLaunch: "Search",
    nowEmpty: "Tap a chart track to start",
    ticker: "Now playing",
    openLyrics: "Open lyrics",
  },
} as const;

export type BoardsI18nKey = keyof typeof boardsDict.zh;

export function boardsT(
  locale: Locale,
  key: BoardsI18nKey,
  vars?: Record<string, string | number>
): string {
  let s: string = boardsDict[locale]?.[key] ?? boardsDict.zh[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

export function useBoardsT(locale: Locale) {
  return useMemo(
    () => (key: BoardsI18nKey, vars?: Record<string, string | number>) =>
      boardsT(locale, key, vars),
    [locale]
  );
}
