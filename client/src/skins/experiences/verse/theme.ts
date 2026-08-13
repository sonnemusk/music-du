import type { ThemeTokens } from "../../theme-catalog";

export const VERSE_LAYOUT = "verse" as const;
export type VerseLayoutId = typeof VERSE_LAYOUT;

export type VerseTheme = Omit<ThemeTokens, "layout"> & {
  layout: VerseLayoutId;
};

/** Muted dark — dusty reading lamp, low chroma brass. */
export const verseDim: VerseTheme = {
  id: "verse-dim",
  name: "词页·昏",
  nameEn: "Verse Dim",
  tagline: "昏灯纸色 · 低饱和夜读",
  taglineEn: "Dim lamp · muted night reading",
  layout: "verse",
  themeColor: "#161410",
  bg: "#161410",
  bg2: "#1e1a16",
  fg: "#e6ddd0",
  muted: "#8a8074",
  accent: "#b89a6a",
  accent2: "#8b7355",
  accentFg: "#1c1610",
  card: "rgba(38, 34, 28, 0.82)",
  line: "rgba(184, 154, 106, 0.18)",
  danger: "#d98980",
  font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Instrument Serif", "Songti SC", Georgia, serif',
  radius: "soft",
  density: "comfy",
  surface: "flat",
  wallpaper:
    "radial-gradient(ellipse 80% 50% at 50% -8%, #2a241c 0%, transparent 58%), radial-gradient(ellipse 40% 30% at 90% 100%, #241c16 0%, transparent 50%), #161410",
};

/** Saturated deep dark — indigo ink, gold + rose. */
export const verseDeep: VerseTheme = {
  id: "verse-deep",
  name: "词页·深",
  nameEn: "Verse Deep",
  tagline: "靛蓝墨海 · 金玫瑰高光",
  taglineEn: "Indigo ink · gold-rose light",
  layout: "verse",
  themeColor: "#070414",
  bg: "#070414",
  bg2: "#12081f",
  fg: "#f3ead8",
  muted: "#9b87b8",
  accent: "#e8b86d",
  accent2: "#c45c8a",
  accentFg: "#1a0c08",
  card: "rgba(22, 12, 40, 0.86)",
  line: "rgba(232, 184, 109, 0.28)",
  danger: "#fb7185",
  font: '"Syne", "DM Sans", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Playfair Display", "Songti SC", Georgia, serif',
  radius: "soft",
  density: "comfy",
  surface: "glass",
  wallpaper:
    "radial-gradient(ellipse 70% 55% at 82% -6%, #3a1458 0%, transparent 52%), radial-gradient(ellipse 55% 40% at 8% 108%, #1c0838 0%, transparent 48%), #070414",
};

export const VERSE_THEMES: VerseTheme[] = [verseDim, verseDeep];

export function isVerseThemeId(id: string): id is "verse-dim" | "verse-deep" {
  return id === "verse-dim" || id === "verse-deep";
}

export function getVerseTheme(id: string): VerseTheme | null {
  return VERSE_THEMES.find((t) => t.id === id) ?? null;
}

export function verseThemeToCssVars(t: VerseTheme): Record<string, string> {
  return {
    "--bg": t.bg,
    "--bg2": t.bg2 || t.bg,
    "--fg": t.fg,
    "--muted": t.muted,
    "--accent": t.accent,
    "--accent2": t.accent2 || t.accent,
    "--accent-fg": t.accentFg,
    "--card": t.card,
    "--line": t.line,
    "--danger": t.danger,
    "--font": t.font,
    "--display-font": t.displayFont || t.font,
    "--mono-font": t.monoFont || t.font,
    "--radius": t.radius === "sharp" ? "2px" : t.radius === "round" ? "18px" : "12px",
    "--radius-sm": t.radius === "sharp" ? "0px" : t.radius === "round" ? "12px" : "8px",
    "--radius-lg": t.radius === "sharp" ? "4px" : t.radius === "round" ? "28px" : "20px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper || t.bg,
  };
}
