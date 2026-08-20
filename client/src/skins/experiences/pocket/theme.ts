import { fontCssVars } from "../../../lib/fonts";
import type { ThemeTokens } from "../../theme-catalog";

export const POCKET_LAYOUT = "pocket" as const;
export type PocketLayoutId = typeof POCKET_LAYOUT;

export type PocketThemeId = "pocket-paper" | "pocket-ink";

export type PocketTheme = Omit<ThemeTokens, "layout"> & {
  layout: PocketLayoutId;
  id: PocketThemeId;
};

const FACE =
  '"DM Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
const PAPER_DISPLAY = '"Instrument Serif", "PingFang SC", Georgia, serif';
const INK_FACE =
  '"Outfit", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
const INK_DISPLAY = '"Syne", "Outfit", "PingFang SC", system-ui, sans-serif';

/** Warm rice paper — cover floats, lyrics are a page turn, not a sheet. */
export const pocketPaper: PocketTheme = {
  id: "pocket-paper",
  name: "袋·纸",
  nameEn: "Pocket Paper",
  tagline: "点封面看词 · 宣纸浅底",
  taglineEn: "Tap cover for lyrics · rice-paper light",
  layout: POCKET_LAYOUT,
  themeColor: "#efe8dc",
  bg: "#efe8dc",
  bg2: "#e4d8c8",
  fg: "#2c241c",
  muted: "#7a6e62",
  accent: "#b5522a",
  accent2: "#3f6f62",
  accentFg: "#fff7f0",
  card: "rgba(255,250,244,0.9)",
  line: "rgba(44,36,28,0.12)",
  danger: "#b4233a",
  font: FACE,
  displayFont: PAPER_DISPLAY,
  radius: "round",
  density: "comfy",
  surface: "raised",
  wallpaper:
    "radial-gradient(ellipse 70% 48% at 12% -8%, #f7f1e6 0%, transparent 56%), radial-gradient(ellipse 50% 36% at 96% 8%, #e2cbb0 0%, transparent 50%), linear-gradient(180deg, #f3ebe0 0%, #e8dccb 100%)",
};

/** Ink field — current line sits under the cover, then the verse fills the stage. */
export const pocketInk: PocketTheme = {
  id: "pocket-ink",
  name: "袋·墨",
  nameEn: "Pocket Ink",
  tagline: "当前句在封面下 · 墨底金线",
  taglineEn: "Current line under cover · ink and gold",
  layout: POCKET_LAYOUT,
  themeColor: "#0b0c10",
  bg: "#0b0c10",
  bg2: "#14161c",
  fg: "#f3eee6",
  muted: "#9a9388",
  accent: "#e4b05a",
  accent2: "#ff6b3d",
  accentFg: "#1a1206",
  card: "rgba(20,22,28,0.72)",
  line: "rgba(228,176,90,0.22)",
  danger: "#ff6b7a",
  font: INK_FACE,
  displayFont: INK_DISPLAY,
  radius: "soft",
  density: "tight",
  surface: "glass",
  wallpaper:
    "radial-gradient(ellipse 70% 50% at 88% -10%, #3a2410 0%, transparent 48%), radial-gradient(ellipse 48% 40% at 4% 108%, #1a1c28 0%, transparent 44%), #0b0c10",
};

export const POCKET_THEMES: PocketTheme[] = [pocketPaper, pocketInk];

export const POCKET_THEME_IDS: PocketThemeId[] = ["pocket-paper", "pocket-ink"];

export const DEFAULT_POCKET_THEME: PocketThemeId = "pocket-paper";

export function isPocketThemeId(v: string): v is PocketThemeId {
  return v === "pocket-paper" || v === "pocket-ink";
}

export function getPocketTheme(id: string): PocketTheme {
  return POCKET_THEMES.find((t) => t.id === id) || pocketPaper;
}

export function pocketThemeToCssVars(t: PocketTheme): Record<string, string> {
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
    "--radius": t.radius === "sharp" ? "2px" : t.radius === "soft" ? "12px" : t.radius === "round" ? "18px" : "16px",
    "--radius-sm": t.radius === "sharp" ? "0px" : t.radius === "soft" ? "8px" : "12px",
    "--radius-lg": t.radius === "sharp" ? "4px" : t.radius === "soft" ? "20px" : t.radius === "round" ? "28px" : "24px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper || t.bg,
  };
}
