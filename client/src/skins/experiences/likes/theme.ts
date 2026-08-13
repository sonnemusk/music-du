export const LIKES_LAYOUT = "likes" as const;

export type LikesThemeId = "likes-dim" | "likes-deep";

export type LikesTheme = {
  id: LikesThemeId;
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  layout: typeof LIKES_LAYOUT;
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

const FACE =
  '"DM Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif';
const DISPLAY = '"Instrument Serif", "Songti SC", Georgia, serif';

/** Muted dark — dusty rose on graphite velvet. */
export const likesDim: LikesTheme = {
  id: "likes-dim",
  name: "匣·雾",
  nameEn: "Keep Dim",
  tagline: "石墨绒面 · 灰粉收藏",
  taglineEn: "Graphite velvet · dusty-rose keeps",
  layout: LIKES_LAYOUT,
  themeColor: "#1a1618",
  bg: "#1a1618",
  bg2: "#221c20",
  fg: "#ece6e3",
  muted: "#9b8f93",
  accent: "#c4a4a8",
  accent2: "#8a6e72",
  accentFg: "#1a1618",
  card: "#262022",
  line: "rgba(196,164,168,0.18)",
  danger: "#e8a0a8",
  font: FACE,
  displayFont: DISPLAY,
  radius: "soft",
  density: "comfy",
  surface: "flat",
  wallpaper:
    "radial-gradient(ellipse 70% 50% at 8% -10%, #3a2c30 0%, transparent 52%), radial-gradient(ellipse 55% 40% at 100% 100%, #2a2226 0%, transparent 48%), #1a1618",
};

/** Saturated deep dark — garnet on ink. */
export const likesDeep: LikesTheme = {
  id: "likes-deep",
  name: "匣·绛",
  nameEn: "Keep Deep",
  tagline: "墨底绛红 · 深封收藏",
  taglineEn: "Ink-black garnet · sealed keeps",
  layout: LIKES_LAYOUT,
  themeColor: "#0a0408",
  bg: "#0a0408",
  bg2: "#16080e",
  fg: "#ffe8ef",
  muted: "#c47a90",
  accent: "#ff2d55",
  accent2: "#c41e3a",
  accentFg: "#1a0408",
  card: "#1a0a12",
  line: "rgba(255,45,85,0.28)",
  danger: "#ff6b81",
  font: FACE,
  displayFont: DISPLAY,
  radius: "soft",
  density: "comfy",
  surface: "raised",
  wallpaper:
    "radial-gradient(ellipse 80% 55% at 12% -8%, #5c1028 0%, transparent 50%), radial-gradient(ellipse 60% 45% at 96% 108%, #3a0618 0%, transparent 46%), #0a0408",
};

export const LIKES_THEMES: LikesTheme[] = [likesDim, likesDeep];

export const LIKES_THEME_IDS: LikesThemeId[] = ["likes-dim", "likes-deep"];

export const DEFAULT_LIKES_THEME: LikesThemeId = "likes-dim";

export function isLikesThemeId(v: string): v is LikesThemeId {
  return v === "likes-dim" || v === "likes-deep";
}

export function getLikesTheme(id: string): LikesTheme {
  return LIKES_THEMES.find((t) => t.id === id) || likesDim;
}

export function likesThemeToCssVars(t: LikesTheme): Record<string, string> {
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
    "--radius": t.radius === "sharp" ? "2px" : t.radius === "soft" ? "12px" : t.radius === "round" ? "18px" : "16px",
    "--radius-sm": t.radius === "sharp" ? "0px" : t.radius === "soft" ? "8px" : "12px",
    "--radius-lg": t.radius === "sharp" ? "4px" : t.radius === "soft" ? "20px" : t.radius === "round" ? "28px" : "24px",
    "--gap": t.density === "tight" ? "6px" : "10px",
    "--pad": t.density === "tight" ? "8px" : "12px",
    "--wallpaper": t.wallpaper || t.bg,
  };
}
