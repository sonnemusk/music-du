import type { Locale } from "../../../i18n";

const STAGE_COPY = {
  zh: {
    wingsAria: "舞台侧幕",
    sheetClose: "收起侧幕",
    themeDim: "暗场",
    themeDeep: "深场",
    themeToggle: "切换舞台灯光",
    searchLaunch: "搜索",
    curtainAria: "收起侧幕",
    lightingAria: "舞台灯光",
  },
  en: {
    wingsAria: "Stage wings",
    sheetClose: "Close wing",
    themeDim: "House dim",
    themeDeep: "Deep gel",
    themeToggle: "Switch stage lighting",
    searchLaunch: "Search",
    curtainAria: "Close wing",
    lightingAria: "Stage lighting",
  },
} as const;

export type StageCopyKey = keyof typeof STAGE_COPY.zh;

export function stageText(locale: Locale, key: StageCopyKey): string {
  return (locale === "en" ? STAGE_COPY.en : STAGE_COPY.zh)[key];
}
