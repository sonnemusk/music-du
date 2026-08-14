import { fontCssVars } from "../../../lib/fonts";

export const SPLIT_LAYOUT = "split" as const;

export type SplitThemeId = "split-dim" | "split-deep";

export type SplitTheme = {
  id: SplitThemeId;
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  layout: typeof SPLIT_LAYOUT;
  themeColor: string;
  bg: string;
  bg2: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  accentFg: string;
  card: string;
  line: string;
  danger: string;
  font: string;
  displayFont: string;
  monoFont: string;
  radius: "sharp" | "soft";
  density: "comfy" | "tight";
  surface: "flat" | "raised";
  wallpaper: string;
};

export const SPLIT_THEME_IDS: readonly SplitThemeId[] = ["split-dim", "split-deep"];

/** Muted graphite listening room — dusty ivory, aged brass. */
export const splitDim: SplitTheme = {
  id: "split-dim",
  name: "微光",
  nameEn: "Dim",
  tagline: "石墨听室 · 旧铜微光",
  taglineEn: "Graphite room · aged brass glow",
  layout: SPLIT_LAYOUT,
  themeColor: "#17181b",
  bg: "#17181b",
  bg2: "#1f2024",
  fg: "#d8d4cc",
  muted: "#8a8680",
  accent: "#9a8b73",
  accent2: "#6e7a72",
  accentFg: "#1a1814",
  card: "#25262a",
  line: "rgba(154, 139, 115, 0.22)",
  danger: "#c47a74",
  font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Instrument Serif", "PingFang SC", Georgia, serif',
  monoFont: '"IBM Plex Mono", ui-monospace, monospace',
  radius: "soft",
  density: "comfy",
  surface: "flat",
  wallpaper:
    "radial-gradient(ellipse 80% 50% at 18% -8%, #2a2b30 0%, transparent 55%), radial-gradient(ellipse 46% 38% at 100% 100%, #242018 0%, transparent 52%), #17181b",
};

/** Saturated abyssal teal-indigo — electric teal seam. */
export const splitDeep: SplitTheme = {
  id: "split-deep",
  name: "深场",
  nameEn: "Deep",
  tagline: "深海靛青 · 电场缝线",
  taglineEn: "Abyssal teal · electric seam",
  layout: SPLIT_LAYOUT,
  themeColor: "#03070d",
  bg: "#03070d",
  bg2: "#07141c",
  fg: "#e8f6ff",
  muted: "#6b8fa3",
  accent: "#14b8a6",
  accent2: "#6366f1",
  accentFg: "#042f2e",
  card: "rgba(8, 26, 38, 0.92)",
  line: "rgba(20, 184, 166, 0.28)",
  danger: "#fb7185",
  font: '"Outfit", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Syne", "PingFang SC", system-ui, sans-serif',
  monoFont: '"JetBrains Mono", ui-monospace, monospace',
  radius: "sharp",
  density: "tight",
  surface: "raised",
  wallpaper:
    "radial-gradient(ellipse 70% 55% at 8% 0%, #0a3d48 0%, transparent 50%), radial-gradient(ellipse 58% 48% at 100% 86%, #1e1b4b 0%, transparent 46%), #03070d",
};

export const SPLIT_THEMES: SplitTheme[] = [splitDim, splitDeep];

export function isSplitThemeId(id: string): id is SplitThemeId {
  return id === "split-dim" || id === "split-deep";
}

export function getSplitTheme(id: string): SplitTheme {
  return SPLIT_THEMES.find((t) => t.id === id) ?? splitDim;
}

export function splitThemeToCssVars(t: SplitTheme): Record<string, string> {
  return {
    "--bg": t.bg,
    "--bg2": t.bg2,
    "--fg": t.fg,
    "--muted": t.muted,
    "--accent": t.accent,
    "--accent2": t.accent2,
    "--accent-fg": t.accentFg,
    "--card": t.card,
    "--line": t.line,
    "--danger": t.danger,
    ...fontCssVars(t),
    "--radius": t.radius === "sharp" ? "2px" : "12px",
    "--radius-sm": t.radius === "sharp" ? "0px" : "8px",
    "--radius-lg": t.radius === "sharp" ? "4px" : "20px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper,
  };
}


