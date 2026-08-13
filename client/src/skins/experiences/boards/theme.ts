import type { ThemeTokens } from "../../theme-catalog";

export const BOARDS_LAYOUT = "boards" as const;

export type BoardsTheme = Omit<ThemeTokens, "layout"> & {
  layout: typeof BOARDS_LAYOUT;
};

export const BOARDS_THEME_IDS = ["boards-dim", "boards-deep"] as const;
export type BoardsThemeId = (typeof BOARDS_THEME_IDS)[number];

export const BOARDS_THEMES: BoardsTheme[] = [
  {
    id: "boards-dim",
    name: "暗榜",
    nameEn: "Boards Dim",
    tagline: "静音炭黑 · 旧铜名次",
    taglineEn: "Muted charcoal · dusty brass ranks",
    layout: "boards",
    themeColor: "#14161a",
    bg: "#14161a",
    bg2: "#1c1e22",
    fg: "#d8d4cc",
    muted: "#8a8680",
    accent: "#b89a6a",
    accent2: "#7a8a78",
    accentFg: "#1a1610",
    card: "rgba(36, 38, 42, 0.88)",
    line: "rgba(184, 154, 106, 0.22)",
    danger: "#d98980",
    font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Space Grotesk", "DM Sans", system-ui, sans-serif',
    monoFont: '"IBM Plex Mono", ui-monospace, monospace',
    radius: "soft",
    density: "comfy",
    surface: "flat",
    wallpaper:
      "radial-gradient(ellipse 70% 50% at 8% -10%, #2a261c 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, #1a2220 0%, transparent 46%), #14161a",
  },
  {
    id: "boards-deep",
    name: "深榜",
    nameEn: "Boards Deep",
    tagline: "夜市灯牌 · 饱和金橙",
    taglineEn: "Night-market board · saturated amber",
    layout: "boards",
    themeColor: "#07040c",
    bg: "#07040c",
    bg2: "#140810",
    fg: "#fff4e6",
    muted: "#c4a48c",
    accent: "#ff7a18",
    accent2: "#ff2d6a",
    accentFg: "#1a0804",
    card: "rgba(28, 10, 18, 0.82)",
    line: "rgba(255, 122, 24, 0.38)",
    danger: "#ff6b81",
    font: '"Outfit", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Syne", "Outfit", system-ui, sans-serif',
    monoFont: '"JetBrains Mono", ui-monospace, monospace',
    radius: "sharp",
    density: "tight",
    surface: "raised",
    wallpaper:
      "radial-gradient(ellipse 65% 55% at 12% -8%, #5a1408 0%, transparent 52%), radial-gradient(ellipse 50% 45% at 96% 8%, #4a0630 0%, transparent 48%), #07040c",
  },
];

export function isBoardsThemeId(id: string): id is BoardsThemeId {
  return (BOARDS_THEME_IDS as readonly string[]).includes(id);
}

export function getBoardsTheme(id: string): BoardsTheme {
  return BOARDS_THEMES.find((t) => t.id === id) || BOARDS_THEMES[0]!;
}
