/**
 * Active skin layouts — only those still used by THEME_CATALOG.
 * Extra layout components may remain in MoreLayouts for future use.
 */
export const LAYOUT_IDS = [
  "side",
  "dock",
  "immersive",
  "compact",
] as const;

export type SkinLayout = (typeof LAYOUT_IDS)[number];

export const LAYOUT_META: Record<
  SkinLayout,
  { name: string; short: string; blurb: string }
> = {
  side: { name: "侧栏", short: "侧", blurb: "左播放器 · 右列表" },
  dock: { name: "Dock", short: "底", blurb: "底部迷你条 + 导航" },
  immersive: { name: "沉浸", short: "浸", blurb: "封面虚化全屏背景" },
  compact: { name: "紧凑", short: "紧", blurb: "顶栏信息 + 列表" },
};

export function isSkinLayout(v: string): v is SkinLayout {
  return (LAYOUT_IDS as readonly string[]).includes(v);
}
