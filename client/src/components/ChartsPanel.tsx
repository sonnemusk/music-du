import { useEffect, useMemo } from "react";
import type { ChartBoardId, ChartPlatformId } from "../lib/types";
import { usePlayer } from "../store/player";
import { TrackList } from "./TrackList";

const FALLBACK_PLATFORMS: {
  id: ChartPlatformId;
  short: string;
  name: string;
  boards?: ChartBoardId[];
}[] = [
  { id: "douyin", short: "抖音", name: "抖音", boards: ["soar", "hot", "new"] },
  { id: "network", short: "网络", name: "网络热歌", boards: ["soar", "hot"] },
  { id: "netease", short: "网易", name: "网易云", boards: ["soar", "hot", "new"] },
  { id: "qq", short: "QQ", name: "QQ 音乐", boards: ["soar", "hot", "new"] },
  { id: "kugou", short: "酷狗", name: "酷狗", boards: ["soar", "hot", "new"] },
  { id: "kuwo", short: "酷我", name: "酷我", boards: ["soar", "hot", "new"] },
  { id: "index", short: "流行", name: "流行指数", boards: ["soar", "hot"] },
  { id: "original", short: "原创", name: "原创", boards: ["hot", "new"] },
];

const FALLBACK_BOARDS: {
  id: ChartBoardId;
  name: string;
  short: string;
  description?: string;
}[] = [
  { id: "soar", name: "飙升", short: "飙", description: "近期上升最快" },
  { id: "hot", name: "热歌", short: "热", description: "综合热度" },
  { id: "new", name: "新歌", short: "新", description: "新发行" },
];

export function ChartsPanel() {
  const platforms = usePlayer((s) => s.chartPlatforms);
  const boards = usePlayer((s) => s.chartBoards);
  const platform = usePlayer((s) => s.chartPlatform);
  const board = usePlayer((s) => s.chartBoard);
  const tracks = usePlayer((s) => s.chartTracks);
  const loading = usePlayer((s) => s.chartLoading);
  const metaName = usePlayer((s) => s.chartMetaName);
  const desc = usePlayer((s) => s.chartMetaDesc);
  const sourceLabel = usePlayer((s) => s.chartSourceLabel);
  const updatedAt = usePlayer((s) => s.chartUpdatedAt);
  const loadCharts = usePlayer((s) => s.loadCharts);
  const setChartPlatform = usePlayer((s) => s.setChartPlatform);
  const setChartBoard = usePlayer((s) => s.setChartBoard);

  useEffect(() => {
    void loadCharts();
  }, [loadCharts]);

  const chips = platforms.length ? platforms : FALLBACK_PLATFORMS;
  const boardChips = boards.length ? boards : FALLBACK_BOARDS;

  const allowedBoards = useMemo(() => {
    const meta = chips.find((p) => p.id === platform);
    const allowed = meta?.boards;
    if (!allowed?.length) return boardChips;
    return boardChips.filter((b) => allowed.includes(b.id));
  }, [chips, platform, boardChips]);

  const updated =
    updatedAt > 0
      ? new Date(updatedAt).toLocaleString("zh-CN", {
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  return (
    <div className="charts-panel">
      <div className="charts-head">
        <div className="charts-title-row">
          <h2 className="charts-title">{metaName || "热榜"}</h2>
          <button
            type="button"
            className="charts-refresh"
            disabled={loading}
            onClick={() => void loadCharts(platform, true, board)}
            title="强制刷新榜单"
          >
            {loading ? "加载中…" : "刷新"}
          </button>
        </div>
        {desc ? <p className="charts-desc">{desc}</p> : null}
        {sourceLabel ? <p className="charts-source">数据源：{sourceLabel}</p> : null}
        {platform === "douyin" ? (
          <p className="charts-hint">
            抖音 ≠ 汽水音乐（汽水是字节听歌 App，同系不同产品）。这里优先短视频向热歌。
          </p>
        ) : null}
        {updated ? <p className="charts-updated">更新于 {updated}</p> : null}
      </div>

      <div className="charts-chips charts-chips--board" role="tablist" aria-label="榜单类型">
        {allowedBoards.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={board === b.id}
            className={`charts-chip charts-chip--board ${board === b.id ? "on" : ""}`}
            onClick={() => setChartBoard(b.id)}
            title={b.description || b.name}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="charts-chips" role="tablist" aria-label="热榜平台">
        {chips.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={platform === p.id}
            className={`charts-chip ${platform === p.id ? "on" : ""}`}
            onClick={() => setChartPlatform(p.id)}
          >
            {p.short || p.name}
          </button>
        ))}
      </div>

      {loading && !tracks.length ? (
        <div className="empty">正在拉取热榜…</div>
      ) : (
        <TrackList
          tracks={tracks}
          mode="charts"
          empty={loading ? "正在拉取热榜…" : "暂无榜单数据，点刷新试试"}
          className="track-list charts-list"
        />
      )}
    </div>
  );
}
