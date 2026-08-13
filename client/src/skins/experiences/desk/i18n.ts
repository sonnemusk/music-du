import { useMemo } from "react";
import type { Locale } from "../../../i18n";
import { usePlayer } from "../../../store/player";

const ZH = {
  library: "曲库",
  nowPlaying: "正在播放",
  searchLaunch: "搜索",
  recents: "最近搜索",
  recentsEmpty: "暂无最近搜索",
  extras: "播放选项",
  locate: "定位当前歌曲",
  nav: "台架导航",
  foot: "台架分区",
} as const;

const EN = {
  library: "Library",
  nowPlaying: "Now playing",
  searchLaunch: "Search",
  recents: "Recent searches",
  recentsEmpty: "No recent searches",
  extras: "Playback options",
  locate: "Locate current track",
  nav: "Desk navigation",
  foot: "Desk sections",
} as const;

export type DeskCopyKey = keyof typeof EN;

const DICT: Record<Locale, Record<DeskCopyKey, string>> = { zh: ZH, en: EN };

export function deskText(locale: Locale, key: DeskCopyKey): string {
  return DICT[locale]?.[key] ?? EN[key];
}

export function useDeskText() {
  const locale = usePlayer((s) => s.locale);
  return useMemo(() => (key: DeskCopyKey) => deskText(locale, key), [locale]);
}
