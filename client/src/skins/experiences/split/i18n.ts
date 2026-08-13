import type { Locale } from "../../../i18n";

export type SplitCopyKey =
  | "experience"
  | "tagline"
  | "sectionsAria"
  | "playerAria"
  | "listAria"
  | "searchLaunch"
  | "together"
  | "idleTitle"
  | "idleArtist";

export const splitDict: Record<Locale, Record<SplitCopyKey, string>> = {
  zh: {
    experience: "并听",
    tagline: "播放器与列表同在",
    sectionsAria: "本站分区",
    playerAria: "正在播放",
    listAria: "当前列表",
    searchLaunch: "搜索",
    together: "同场",
    idleTitle: "点一首，两边一起听",
    idleArtist: "播放器与列表不会分开",
  },
  en: {
    experience: "Split Listen",
    tagline: "Player and list, both present",
    sectionsAria: "Site sections",
    playerAria: "Now playing",
    listAria: "Current list",
    searchLaunch: "Search",
    together: "Together",
    idleTitle: "Pick a track — both panes stay",
    idleArtist: "Player and list never leave",
  },
};

export function splitT(locale: Locale, key: SplitCopyKey): string {
  return splitDict[locale]?.[key] ?? splitDict.zh[key] ?? key;
}
