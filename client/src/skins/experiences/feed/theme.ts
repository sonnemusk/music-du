import { fontCssVars } from "../../../lib/fonts";
import type { ThemeTokens } from "../../theme-catalog";

export const LAYOUT_ID = "feed" as const;

export type FeedLayoutId = typeof LAYOUT_ID;

export type FeedTheme = Omit<ThemeTokens, "layout"> & { layout: FeedLayoutId };

export const LAYOUT_META: Record<
  FeedLayoutId,
  { name: string; short: string; blurb: string }
> = {
  feed: { name: "竖滑", short: "滑", blurb: "全屏封面 · 上下滑切歌" },
};

export const THEMES: FeedTheme[] = [
  {
    id: "feed-dim",
    name: "薄暮",
    nameEn: "Dim Reel",
    tagline: "石墨暗厅 · 旧铜字幕",
    taglineEn: "Muted cinema dark · dusty brass titles",
    layout: "feed",
    themeColor: "#161513",
    bg: "#161513",
    bg2: "#1e1c19",
    fg: "#f0ebe3",
    muted: "#9a9288",
    accent: "#c9a27a",
    accent2: "#8a7a6a",
    accentFg: "#1a1410",
    card: "rgba(36, 32, 28, 0.78)",
    line: "rgba(201, 162, 122, 0.22)",
    danger: "#e07a5f",
    font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Instrument Serif", "PingFang SC", Georgia, serif',
    radius: "soft",
    density: "comfy",
    surface: "glass",
    wallpaper:
      "radial-gradient(ellipse 70% 50% at 18% -8%, #3a3228 0%, transparent 55%), radial-gradient(ellipse 55% 40% at 92% 8%, #2a221c 0%, transparent 50%), #161513",
  },
  {
    id: "feed-deep",
    name: "深渊",
    nameEn: "Deep Reel",
    tagline: "墨紫夜场 · 品红切面",
    taglineEn: "Ink-violet night · magenta cut",
    layout: "feed",
    themeColor: "#08010f",
    bg: "#08010f",
    bg2: "#14061f",
    fg: "#f6edff",
    muted: "#b39cc9",
    accent: "#ff2d92",
    accent2: "#7c3aed",
    accentFg: "#1a0210",
    card: "rgba(28, 8, 42, 0.72)",
    line: "rgba(255, 45, 146, 0.28)",
    danger: "#fb7185",
    font: '"Syne", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Syne", "PingFang SC", system-ui, sans-serif',
    radius: "round",
    density: "comfy",
    surface: "glass",
    wallpaper:
      "radial-gradient(ellipse 65% 55% at 12% 0%, #4a1570 0%, transparent 52%), radial-gradient(ellipse 50% 45% at 90% 85%, #7a1248 0%, transparent 48%), #08010f",
  },
];

export function getFeedTheme(id?: string): FeedTheme {
  return THEMES.find((t) => t.id === id) || THEMES[0]!;
}

/** Same token names SkinHost uses, plus reel extras. */
export function feedThemeToCssVars(t: FeedTheme): Record<string, string> {
  const dim = t.id === "feed-dim";
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
    "--radius": t.radius === "round" ? "18px" : "12px",
    "--radius-sm": t.radius === "round" ? "12px" : "8px",
    "--radius-lg": t.radius === "round" ? "28px" : "20px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper || t.bg,
    "--feed-veil": dim ? "rgba(10, 8, 6, 0.42)" : "rgba(6, 0, 12, 0.46)",
    "--feed-grain": dim ? "rgba(240, 235, 227, 0.045)" : "rgba(255, 220, 245, 0.05)",
    "--feed-notch": dim ? "rgba(12, 10, 8, 0.92)" : "rgba(4, 0, 10, 0.92)",
  };
}
