import { fontCssVars } from "../../../lib/fonts";

export const FIND_LAYOUT = "find" as const;

export type FindThemeId = "find-dim" | "find-deep";

export type FindThemeTokens = {
  id: FindThemeId;
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  layout: typeof FIND_LAYOUT;
  themeColor: string;
  bg: string;
  bg2?: string;
  fg: string;
  muted: string;
  accent: string;
  accent2?: string;
  accentFg: string;
  card: string;
  line: string;
  danger: string;
  font: string;
  displayFont?: string;
  monoFont?: string;
  radius: "sharp" | "soft" | "round" | "pill";
  density: "comfy" | "tight";
  surface: "glass" | "flat" | "raised" | "outline";
  wallpaper?: string;
};

export const FIND_THEMES: FindThemeTokens[] = [
  {
    id: "find-dim",
    name: "检索淡夜",
    nameEn: "Find Dim",
    tagline: "雾灰检索 · 结果即队列",
    taglineEn: "Muted index · results are the queue",
    layout: FIND_LAYOUT,
    themeColor: "#161816",
    bg: "#161816",
    bg2: "#1e211e",
    fg: "#e4e6e1",
    muted: "#8b9188",
    accent: "#9aaa7e",
    accent2: "#c4b59a",
    accentFg: "#1a1c18",
    card: "rgba(38, 42, 38, 0.88)",
    line: "rgba(154, 170, 126, 0.22)",
    danger: "#d98880",
    font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Space Grotesk", "DM Sans", system-ui, sans-serif',
    monoFont: '"IBM Plex Mono", ui-monospace, monospace',
    radius: "soft",
    density: "comfy",
    surface: "flat",
    wallpaper:
      "radial-gradient(ellipse 90% 48% at 50% -8%, #2a2e28 0%, transparent 56%), radial-gradient(ellipse 42% 28% at 92% 88%, #232820 0%, transparent 50%), #161816",
  },
  {
    id: "find-deep",
    name: "检索深靛",
    nameEn: "Find Deep",
    tagline: "靛黑检索 · 琥珀回波",
    taglineEn: "Ink indigo · amber ping",
    layout: FIND_LAYOUT,
    themeColor: "#05030d",
    bg: "#05030d",
    bg2: "#0e0a1c",
    fg: "#f4efe6",
    muted: "#9a8fb8",
    accent: "#ffb020",
    accent2: "#2ee6c8",
    accentFg: "#1a0e02",
    card: "rgba(18, 12, 36, 0.86)",
    line: "rgba(255, 176, 32, 0.28)",
    danger: "#ff6b7a",
    font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Space Grotesk", "DM Sans", system-ui, sans-serif',
    monoFont: '"IBM Plex Mono", ui-monospace, monospace',
    radius: "sharp",
    density: "tight",
    surface: "outline",
    wallpaper:
      "radial-gradient(ellipse 80% 52% at 50% -12%, #1a1240 0%, transparent 52%), radial-gradient(circle at 88% 92%, #3b1808 0%, transparent 40%), #05030d",
  },
];

export function getFindTheme(id: string): FindThemeTokens {
  return FIND_THEMES.find((t) => t.id === id) || FIND_THEMES[0];
}

export function findThemeToCssVars(t: FindThemeTokens): Record<string, string> {
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
    "--radius":
      t.radius === "sharp" ? "2px" : t.radius === "soft" ? "12px" : t.radius === "round" ? "18px" : "16px",
    "--radius-sm":
      t.radius === "sharp" ? "0px" : t.radius === "soft" ? "8px" : t.radius === "round" ? "12px" : "12px",
    "--radius-lg":
      t.radius === "sharp" ? "4px" : t.radius === "soft" ? "20px" : t.radius === "round" ? "28px" : "24px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper || t.bg,
  };
}
