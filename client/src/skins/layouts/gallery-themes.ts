import type { ThemeTokens } from "../theme-catalog";

export const LAYOUT_ID = "gallery" as const;

export type GalleryTheme = Omit<ThemeTokens, "layout"> & { layout: typeof LAYOUT_ID };

/** Cool limestone hall — moonlit plaster, not the old warm paper atrium. */
const PALE: GalleryTheme = {
  id: "gallery-pale",
  name: "廊·浅",
  nameEn: "Gallery Pale",
  tagline: "月石灰壁 · 铜绿点缀",
  taglineEn: "Moonlit plaster · oxidized teal",
  layout: LAYOUT_ID,
  themeColor: "#cfd6df",
  bg: "#cfd6df",
  bg2: "#c0c8d2",
  fg: "#1a2330",
  muted: "#5a6574",
  accent: "#1a7a72",
  accent2: "#3d5c7a",
  accentFg: "#eef7f5",
  card: "rgba(236,240,245,0.86)",
  line: "rgba(26,35,48,0.14)",
  danger: "#b4233a",
  font: '"Space Grotesk", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Playfair Display", Georgia, serif',
  monoFont: '"IBM Plex Mono", ui-monospace, monospace',
  radius: "soft",
  density: "comfy",
  surface: "raised",
  wallpaper:
    "radial-gradient(ellipse 68% 52% at 10% -6%, #e2e8ef 0%, transparent 58%), radial-gradient(ellipse 52% 40% at 96% 8%, #b9c6d4 0%, transparent 50%), linear-gradient(180deg, #d5dce5 0%, #c8d0da 100%)",
};

/** Saturated museum night — ink indigo, amber jewel, glass vitrines. */
const DEEP: GalleryTheme = {
  id: "gallery-deep",
  name: "廊·深",
  nameEn: "Gallery Deep",
  tagline: "馆夜墨靛 · 琥珀焦光",
  taglineEn: "Museum night · amber jewel",
  layout: LAYOUT_ID,
  themeColor: "#11141c",
  bg: "#11141c",
  bg2: "#181c28",
  fg: "#e8edf6",
  muted: "#8b93a8",
  accent: "#e89a1a",
  accent2: "#ff5a3c",
  accentFg: "#1a1206",
  card: "rgba(28,32,44,0.72)",
  line: "rgba(232,154,26,0.22)",
  danger: "#ff6b7a",
  font: '"Outfit", "PingFang SC", system-ui, sans-serif',
  displayFont: '"Syne", "Outfit", system-ui, sans-serif',
  monoFont: '"JetBrains Mono", ui-monospace, monospace',
  radius: "sharp",
  density: "tight",
  surface: "glass",
  wallpaper:
    "radial-gradient(ellipse 70% 48% at 90% -8%, #3a2410 0%, transparent 48%), radial-gradient(ellipse 48% 40% at 4% 108%, #1a2848 0%, transparent 44%), #11141c",
};

export const GALLERY_THEMES: GalleryTheme[] = [PALE, DEEP];
