/**
 * Active skin layouts — only those still used by THEME_CATALOG.
 * (side / immersive / compact only; showcase layouts removed)
 */
export const LAYOUT_IDS = [
  "side",
  "immersive",
  "compact",
  "gallery",
] as const;

export type SkinLayout = (typeof LAYOUT_IDS)[number];

export const LAYOUT_META: Record<
  SkinLayout,
  { name: string; short: string; blurb: string }
> = {
  side: { name: "侧栏", short: "侧", blurb: "左播放器 · 右列表" },
  immersive: { name: "沉浸", short: "浸", blurb: "封面虚化全屏背景" },
  compact: { name: "紧凑", short: "紧", blurb: "顶栏信息 + 列表" },
  gallery: { name: "画廊", short: "廊", blurb: "导航栏 · 封面网格 · 播放台" },
};

export function isSkinLayout(v: string): v is SkinLayout {
  return (LAYOUT_IDS as readonly string[]).includes(v);
}
