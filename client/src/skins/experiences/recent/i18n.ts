import type { Locale } from "../../../i18n";

const zh = {
  brandMark: "足迹",
  kicker: "接着听",
  historyTitle: "播放足迹",
  historyLead: "从上次停下的地方继续",
  justNow: "刚刚",
  earlier: "更早",
  count: "{n} 首",
  emptyHistory: "还没有足迹，听一首开始这条路",
  miniAria: "迷你播放条",
  navAria: "足迹导航",
  resume: "继续",
  idleTitle: "还没在播",
  idleArtist: "从足迹里点一首",
  historyNav: "足迹",
  historyNavShort: "足迹",
};

const en = {
  brandMark: "Trail",
  kicker: "Pick up",
  historyTitle: "Listening trail",
  historyLead: "Continue from where you left off",
  justNow: "Just now",
  earlier: "Earlier",
  count: "{n} tracks",
  emptyHistory: "No footprints yet — play a song to start the trail",
  miniAria: "Mini player",
  navAria: "Trail navigation",
  resume: "Resume",
  idleTitle: "Nothing playing",
  idleArtist: "Pick a track from the trail",
  historyNav: "Trail",
  historyNavShort: "Trail",
};

export const recentCopy = { zh, en } as const;

export type RecentCopyKey = keyof typeof zh;

export function rt(
  locale: Locale,
  key: RecentCopyKey,
  vars?: Record<string, string | number>
): string {
  let s: string = (locale === "en" ? en : zh)[key] || zh[key];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
