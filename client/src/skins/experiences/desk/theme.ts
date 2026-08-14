import { fontCssVars } from "../../../lib/fonts";
import type { ThemeTokens } from "../../theme-catalog";

export const LAYOUT_ID = "desk" as const;

export type DeskTheme = Omit<ThemeTokens, "layout"> & { layout: typeof LAYOUT_ID };

export const LAYOUT_META = {
  name: "台架",
  nameEn: "Desk",
  blurb: "左导航 · 中间列表 · 底通栏播放条",
  blurbEn: "Left nav · center list · bottom transport",
};

/** Muted warm pewter — office desk at dusk. */
const DIM: DeskTheme = {
  id: "desk-dim",
  name: "台架·暮",
  nameEn: "Desk Dim",
  tagline: "暖灰桌面 · 铜线点缀",
  taglineEn: "Warm pewter desk · brass hairline",
  layout: LAYOUT_ID,
  themeColor: "#1c1b18",
  bg: "#1c1b18",
  bg2: "#26241f",
  fg: "#e8e2d6",
  muted: "#9a9386",
  accent: "#c4a574",
  accent2: "#8a9a76",
  accentFg: "#1c1b18",
  card: "#2a2823",
  line: "#3d3a33",
  danger: "#d4887a",
  font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
  displayFont: '"DM Sans", "PingFang SC", system-ui, sans-serif',
  monoFont: '"IBM Plex Mono", ui-monospace, monospace',
  radius: "soft",
  density: "comfy",
  surface: "raised",
  wallpaper:
    "radial-gradient(ellipse 70% 50% at 0% 0%, #2e2a22 0%, transparent 55%), linear-gradient(180deg, #221f1b 0%, #1c1b18 100%)",
};

/** Saturated ink-navy — night mixer console. */
const DEEP: DeskTheme = {
  id: "desk-deep",
  name: "台架·渊",
  nameEn: "Desk Deep",
  tagline: "墨蓝控台 · 青绿磷光",
  taglineEn: "Ink-navy console · teal phosphor",
  layout: LAYOUT_ID,
  themeColor: "#05141f",
  bg: "#05141f",
  bg2: "#0a1d2c",
  fg: "#d7f3ff",
  muted: "#6b90a6",
  accent: "#14d4c8",
  accent2: "#3d8bff",
  accentFg: "#031018",
  card: "#0c2030",
  line: "#164058",
  danger: "#ff6b7a",
  font: '"Space Grotesk", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Syne", "Space Grotesk", system-ui, sans-serif',
  monoFont: '"IBM Plex Mono", ui-monospace, monospace',
  radius: "sharp",
  density: "tight",
  surface: "flat",
  wallpaper:
    "radial-gradient(ellipse 80% 55% at 100% 0%, #0a3a48 0%, transparent 50%), radial-gradient(circle at 0% 100%, #062a4a 0%, transparent 42%), #05141f",
};

export const THEMES: DeskTheme[] = [DIM, DEEP];

export function getDeskTheme(id?: string): DeskTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]!;
}

export function deskThemeVars(t: DeskTheme): Record<string, string> {
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
    ...fontCssVars(t),
    "--radius": t.radius === "sharp" ? "2px" : t.radius === "round" ? "18px" : "12px",
    "--radius-sm": t.radius === "sharp" ? "0px" : "8px",
    "--radius-lg": t.radius === "sharp" ? "4px" : "20px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper || t.bg,
  };
}
