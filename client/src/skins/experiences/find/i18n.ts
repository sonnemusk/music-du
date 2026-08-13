import type { Locale } from "../../../i18n";

const FIND_COPY = {
  zh: {
    mark: "检索",
    kicker: "打开就能搜 · 结果即队列",
    queueHint: "{n} 首 · 此列表就是队列",
    queueEmpty: "输入歌名或歌手，回车即列入队",
    drawers: "搜不到时",
    drawersAria: "收藏、历史、榜单与其它列表",
    overlay: "展开搜索层",
    playing: "正在播放",
    idle: "未在播放",
    backToSearch: "回检索",
    lyricsFromCover: "打开歌词",
  },
  en: {
    mark: "Find",
    kicker: "Open to search · results are the queue",
    queueHint: "{n} tracks · this list is the queue",
    queueEmpty: "Type a song or artist — hits become the queue",
    drawers: "If you can't find it",
    drawersAria: "Liked, history, charts and other lists",
    overlay: "Open search layer",
    playing: "Now playing",
    idle: "Nothing playing",
    backToSearch: "Back to search",
    lyricsFromCover: "Open lyrics",
  },
} as const;

export type FindCopyKey = keyof typeof FIND_COPY.en;

export function findText(
  locale: Locale,
  key: FindCopyKey,
  vars?: Record<string, string | number>
): string {
  let s: string = (locale === "en" ? FIND_COPY.en : FIND_COPY.zh)[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
