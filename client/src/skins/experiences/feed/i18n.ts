export type FeedLocale = "zh" | "en";

const zh = {
  layoutName: "竖滑",
  layoutBlurb: "全屏封面，上下滑切歌",
  queueAria: "队列来源",
  queueFavorites: "收藏",
  queueHistory: "历史",
  queuePlaylist: "列表",
  queueCharts: "榜单",
  lyrics: "歌词",
  queue: "队列",
  swipeHint: "上滑下一首 · 下滑上一首",
  emptyQueue: "这个队列还是空的",
  searchLaunch: "搜索",
  closePanel: "关闭",
  nowPlaying: "正在播放",
  indexAria: "队列进度",
  prevTrack: "上一首",
  nextTrack: "下一首",
  playPause: "播放/暂停",
  navAria: "切歌",
};

const en: typeof zh = {
  layoutName: "Reel",
  layoutBlurb: "Full-screen cover — swipe up or down to change tracks",
  queueAria: "Queue source",
  queueFavorites: "Liked",
  queueHistory: "History",
  queuePlaylist: "Playlist",
  queueCharts: "Charts",
  lyrics: "Lyrics",
  queue: "Queue",
  swipeHint: "Swipe up for next · down for previous",
  emptyQueue: "This queue is empty",
  searchLaunch: "Search",
  closePanel: "Close",
  nowPlaying: "Now playing",
  indexAria: "Place in queue",
  prevTrack: "Previous",
  nextTrack: "Next",
  playPause: "Play / pause",
  navAria: "Track controls",
};

const DICTS: Record<FeedLocale, typeof zh> = { zh, en };

export type FeedMsg = keyof typeof zh;

export function feedT(locale: FeedLocale, key: FeedMsg): string {
  return DICTS[locale][key] ?? DICTS.zh[key] ?? key;
}

export { zh as feedZh, en as feedEn };
