import type { ThemeTokens } from "../../theme-catalog";

export const LAYOUT_ID = "dock" as const;

export type DockTheme = Omit<ThemeTokens, "layout"> & { layout: typeof LAYOUT_ID };

export const LAYOUT_META: Record<
  typeof LAYOUT_ID,
  { name: string; short: string; blurb: string }
> = {
  dock: {
    name: "泊位",
    short: "泊",
    blurb: "底栏迷你条 · 点开大播放页",
  },
};

/** Two dark berths — dim fog vs jewel water. Hues and hexes must stay distinct. */
export const THEMES: DockTheme[] = [
  {
    id: "dock-dim",
    name: "薄雾泊位",
    nameEn: "Dim Berth",
    tagline: "低饱和港雾 · 静夜靠岸",
    taglineEn: "Low-sat harbor fog · quiet night berth",
    layout: "dock",
    themeColor: "#2a2b28",
    bg: "#2a2b28",
    bg2: "#232420",
    fg: "#e6e3da",
    muted: "#9a968c",
    accent: "#c4b496",
    accent2: "#8c8f82",
    accentFg: "#1c1d1a",
    card: "#363832",
    line: "#4a4c44",
    danger: "#d9897a",
    font: '"Outfit", "DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Outfit", "DM Sans", system-ui, sans-serif',
    radius: "soft",
    density: "comfy",
    surface: "flat",
    wallpaper:
      "radial-gradient(ellipse 80% 50% at 8% -8%, #3d3f38 0%, transparent 55%), radial-gradient(ellipse 55% 40% at 96% 108%, #2c2822 0%, transparent 50%), #2a2b28",
  },
  {
    id: "dock-deep",
    name: "深礁泊位",
    nameEn: "Deep Berth",
    tagline: "宝石深水 · 灯塔青碧",
    taglineEn: "Jewel deep water · teal beacon",
    layout: "dock",
    themeColor: "#061a16",
    bg: "#061a16",
    bg2: "#0a2620",
    fg: "#e4fff6",
    muted: "#7eb8a8",
    accent: "#2affc8",
    accent2: "#7c5cff",
    accentFg: "#04241c",
    card: "rgba(10, 48, 40, 0.78)",
    line: "rgba(42, 255, 200, 0.28)",
    danger: "#ff7a9a",
    font: '"Syne", "DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Syne", "DM Sans", system-ui, sans-serif',
    radius: "round",
    density: "comfy",
    surface: "glass",
    wallpaper:
      "radial-gradient(ellipse 70% 48% at 82% -4%, #0d4a3c 0%, transparent 52%), radial-gradient(ellipse 50% 42% at 8% 100%, #16305a 0%, transparent 46%), #061a16",
  },
];
