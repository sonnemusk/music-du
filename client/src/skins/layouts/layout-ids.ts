/**
 * All skin layouts — each must feel structurally different
 * (not just color). Keep ids stable for theme catalog.
 */
export const LAYOUT_IDS = [
  "side",
  "dock",
  "immersive",
  "split",
  "compact",
  // —— new batch ——
  "stack",
  "theater",
  "rail",
  "magazine",
  "card",
  "grid",
  "strip",
  "poster",
  "focus",
  "library",
  "cinematic",
  "zen",
  "console",
  "sheet",
  "mosaic",
] as const;

export type SkinLayout = (typeof LAYOUT_IDS)[number];

export const LAYOUT_META: Record<
  SkinLayout,
  { name: string; short: string; blurb: string }
> = {
  side: { name: "侧栏", short: "侧", blurb: "左播放器 · 右列表" },
  dock: { name: "Dock", short: "底", blurb: "底部迷你条 + 导航" },
  immersive: { name: "沉浸", short: "浸", blurb: "封面虚化全屏背景" },
  split: { name: "分栏", short: "分", blurb: "封面英雄区 + 文案" },
  compact: { name: "紧凑", short: "紧", blurb: "顶栏信息 + 列表" },
  stack: { name: "堆叠", short: "堆", blurb: "大封面纵向堆叠" },
  theater: { name: "剧场", short: "剧", blurb: "歌词舞台中央" },
  rail: { name: "轨栏", short: "轨", blurb: "左侧图标轨导航" },
  magazine: { name: "杂志", short: "志", blurb: "大标题编辑排版" },
  card: { name: "卡片", short: "卡", blurb: "居中悬浮播放卡" },
  grid: { name: "宫格", short: "宫", blurb: "封面墙点选" },
  strip: { name: "底栏", short: "栏", blurb: "列表为主 · 底播放条" },
  poster: { name: "海报", short: "报", blurb: "全高竖海报" },
  focus: { name: "专注", short: "专", blurb: "只看当前曲" },
  library: { name: "曲库", short: "库", blurb: "密表曲库浏览" },
  cinematic: { name: "电影", short: "影", blurb: "宽银幕信箱" },
  zen: { name: "禅", short: "禅", blurb: "极简封面+播放" },
  console: { name: "控制台", short: "台", blurb: "多面板仪表盘" },
  sheet: { name: "抽屉", short: "抽", blurb: "上播放 · 下抽屉列表" },
  mosaic: { name: "马赛克", short: "嵌", blurb: "不对称 Bento 嵌套" },
};

export function isSkinLayout(v: string): v is SkinLayout {
  return (LAYOUT_IDS as readonly string[]).includes(v);
}
