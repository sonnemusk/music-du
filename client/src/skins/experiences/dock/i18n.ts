import { useMemo } from "react";
import { useT, type Locale } from "../../../i18n";
import type { Dict } from "../../../i18n/types";

export const dockZh: Dict = {
  shell: {
    navAria: "泊位导航",
    railAria: "内容泊位",
    toolsAria: "语言与外观",
    miniAria: "迷你播放条",
    sheetAria: "正在播放",
    expand: "打开播放页",
    collapse: "收起播放页",
    board: "登船",
    ashore: "靠岸",
    idle: "空泊位",
    slipHint: "点封面打开大播放页",
    locate: "定位",
    searchLaunch: "搜索",
    openLyrics: "查看歌词",
    progressAria: "播放进度",
    recent: "最近搜索",
    queueHint: "当前队列",
  },
};

export const dockEn: Dict = {
  shell: {
    navAria: "Berth navigation",
    railAria: "Content slips",
    toolsAria: "Language and theme",
    miniAria: "Mini player",
    sheetAria: "Now playing",
    expand: "Open now playing",
    collapse: "Close now playing",
    board: "Board",
    ashore: "Ashore",
    idle: "Empty slip",
    slipHint: "Tap the cover for the full player",
    locate: "Locate",
    searchLaunch: "Search",
    openLyrics: "Open lyrics",
    progressAria: "Playback progress",
    recent: "Recent searches",
    queueHint: "Now in queue",
  },
};

function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split(".");
  let cur: string | Dict | undefined = dict;
  for (const p of parts) {
    if (cur == null || typeof cur === "string") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  let out = s;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** Extra `shell` keys, then the shared dictionary. */
export function useDockT(locale: Locale) {
  const base = useT(locale);
  return useMemo(
    () =>
      (key: string, vars?: Record<string, string | number>) => {
        const extra =
          lookup(locale === "en" ? dockEn : dockZh, key) ?? lookup(dockZh, key);
        if (extra) return fill(extra, vars);
        return base(key, vars);
      },
    [locale, base]
  );
}
