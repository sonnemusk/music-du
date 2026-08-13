/**
 * Active skin layouts used by THEME_CATALOG.
 * First ten are the 2026 experience shells (dim/deep palettes).
 * Last four are the original shared chrome layouts.
 */
export const LAYOUT_IDS = [
  "dock",
  "desk",
  "feed",
  "stage",
  "verse",
  "likes",
  "recent",
  "find",
  "boards",
  "split",
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
  dock: { name: "泊位", short: "泊", blurb: "底栏迷你条 · 点开大播放页" },
  desk: { name: "台架", short: "台", blurb: "左导航 · 底通栏播放条" },
  feed: { name: "竖滑", short: "滑", blurb: "全屏封面 · 上下滑切歌" },
  stage: { name: "舞台", short: "舞", blurb: "打开即播放页" },
  verse: { name: "词页", short: "词", blurb: "歌词主画面 · 点词跳进度" },
  likes: { name: "收藏", short: "藏", blurb: "打开先看喜欢的歌" },
  recent: { name: "足迹", short: "迹", blurb: "打开先看播放历史" },
  find: { name: "检索", short: "搜", blurb: "打开就能搜" },
  boards: { name: "榜单", short: "榜", blurb: "多平台热歌入口" },
  split: { name: "并听", short: "并", blurb: "播放器和列表同时在" },
  side: { name: "侧栏", short: "侧", blurb: "左播放器 · 右列表" },
  immersive: { name: "沉浸", short: "浸", blurb: "封面虚化全屏背景" },
  compact: { name: "紧凑", short: "紧", blurb: "顶栏信息 + 列表" },
  gallery: { name: "画廊", short: "廊", blurb: "导航栏 · 封面网格 · 播放台" },
};

export function isSkinLayout(v: string): v is SkinLayout {
  return (LAYOUT_IDS as readonly string[]).includes(v);
}
