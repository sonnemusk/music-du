import type { ThemeTokens } from "../../theme-catalog";

export const RECENT_LAYOUT = "recent" as const;
export type RecentLayoutId = typeof RECENT_LAYOUT;

export type RecentThemeId = "recent-dim" | "recent-deep";

export type RecentTheme = Omit<ThemeTokens, "layout" | "id"> & {
  id: RecentThemeId;
  layout: RecentLayoutId;
};

export const RECENT_THEME_IDS: readonly RecentThemeId[] = [
  "recent-dim",
  "recent-deep",
];

/** Muted dark — warm charcoal fog, dusty brass, paper steps. */
export const recentDim: RecentTheme = {
  id: "recent-dim",
  name: "浅迹",
  nameEn: "Dim Trail",
  tagline: "雾灰足迹 · 静音暗场",
  taglineEn: "Muted trail · quiet dark",
  layout: "recent",
  themeColor: "#14161a",
  bg: "#14161a",
  bg2: "#1b1d22",
  fg: "#d8d4cc",
  muted: "#8a8680",
  accent: "#c4b59a",
  accent2: "#7d8b7a",
  accentFg: "#1a1610",
  card: "rgba(42, 40, 36, 0.72)",
  line: "rgba(196, 181, 154, 0.22)",
  danger: "#d98984",
  font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Instrument Serif", Georgia, serif',
  radius: "soft",
  density: "comfy",
  surface: "flat",
  wallpaper:
    "radial-gradient(ellipse 80% 50% at 8% -8%, #2a2c30 0%, transparent 56%), radial-gradient(ellipse 55% 40% at 96% 8%, #232018 0%, transparent 48%), #14161a",
};

/** Saturated deep dark — indigo ink, electric blue / violet, glass steps. */
export const recentDeep: RecentTheme = {
  id: "recent-deep",
  name: "深迹",
  nameEn: "Deep Trail",
  tagline: "靛夜足迹 · 饱和深暗",
  taglineEn: "Indigo trail · saturated dark",
  layout: "recent",
  themeColor: "#070b14",
  bg: "#070b14",
  bg2: "#0c1426",
  fg: "#e8eefc",
  muted: "#7a8ab0",
  accent: "#4c8dff",
  accent2: "#7c5cff",
  accentFg: "#061018",
  card: "rgba(16, 24, 48, 0.78)",
  line: "rgba(76, 141, 255, 0.32)",
  danger: "#fb7185",
  font: '"Space Grotesk", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Syne", "Space Grotesk", sans-serif',
  radius: "soft",
  density: "comfy",
  surface: "glass",
  wallpaper:
    "radial-gradient(ellipse 70% 52% at 82% -10%, #1a2a6c 0%, transparent 50%), radial-gradient(ellipse 48% 38% at 0% 100%, #3b1d7a 0%, transparent 44%), #070b14",
};

export const RECENT_THEMES: readonly RecentTheme[] = [recentDim, recentDeep];

export function getRecentTheme(id: string): RecentTheme {
  return RECENT_THEMES.find((t) => t.id === id) || recentDim;
}

export function isRecentThemeId(id: string): id is RecentThemeId {
  return id === "recent-dim" || id === "recent-deep";
}

export function recentThemeToCssVars(t: RecentTheme): Record<string, string> {
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
    "--wallpaper": t.wallpaper || t.bg,
  };
}
