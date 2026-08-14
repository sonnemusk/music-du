export const STAGE_LAYOUT = "stage" as const;

export const STAGE_THEME_IDS = ["stage-dim", "stage-deep"] as const;

export type StageThemeId = (typeof STAGE_THEME_IDS)[number];

export type StageTheme = {
  id: StageThemeId;
  name: string;
  nameEn: string;
  tagline: string;
  taglineEn: string;
  layout: typeof STAGE_LAYOUT;
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

export const STAGE_THEMES: StageTheme[] = [
  {
    id: "stage-dim",
    name: "暗场",
    nameEn: "House dim",
    tagline: "观众席熄灯 · 哑金脚灯",
    taglineEn: "House lights down · dusty gold foots",
    layout: STAGE_LAYOUT,
    themeColor: "#16130f",
    bg: "#16130f",
    bg2: "#221e18",
    fg: "#ebe4d6",
    muted: "#8f877a",
    accent: "#c4a574",
    accent2: "#8b7355",
    accentFg: "#1a1610",
    card: "rgba(40, 36, 30, 0.9)",
    line: "rgba(196, 165, 116, 0.2)",
    danger: "#e07a5f",
    font: '"DM Sans", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Instrument Serif", "Songti SC", Georgia, serif',
    radius: "soft",
    density: "comfy",
    surface: "glass",
    wallpaper:
      "radial-gradient(ellipse 70% 55% at 50% -10%, #3a3226 0%, transparent 58%), radial-gradient(ellipse 40% 30% at 80% 100%, #2a2318 0%, transparent 50%), #16130f",
  },
  {
    id: "stage-deep",
    name: "深场",
    nameEn: "Deep gel",
    tagline: "洋红追光 · 饱和夜场",
    taglineEn: "Magenta follow-spot · saturated night",
    layout: STAGE_LAYOUT,
    themeColor: "#120018",
    bg: "#120018",
    bg2: "#24082c",
    fg: "#fde8f1",
    muted: "#c47a9c",
    accent: "#ff2d6a",
    accent2: "#ffc43d",
    accentFg: "#1a0510",
    card: "rgba(36, 8, 32, 0.92)",
    line: "rgba(255, 45, 106, 0.32)",
    danger: "#fb7185",
    font: '"Syne", "PingFang SC", system-ui, sans-serif',
    displayFont: '"Playfair Display", "Songti SC", Georgia, serif',
    radius: "round",
    density: "comfy",
    surface: "raised",
    wallpaper:
      "radial-gradient(ellipse 65% 50% at 50% -8%, #6b1038 0%, transparent 55%), radial-gradient(ellipse 45% 40% at 100% 90%, #4a1480 0%, transparent 48%), radial-gradient(circle at 8% 80%, #3b0764 0%, transparent 36%), #120018",
  },
];

export function isStageThemeId(v: unknown): v is StageThemeId {
  return v === "stage-dim" || v === "stage-deep";
}

export function getStageTheme(id: string): StageTheme {
  return STAGE_THEMES.find((t) => t.id === id) || STAGE_THEMES[0]!;
}

export function stageThemeToCssVars(t: StageTheme): Record<string, string> {
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
