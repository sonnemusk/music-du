import { useEffect, useMemo } from "react";
import { useT } from "../i18n";
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
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  useEffect(() => {
    void loadCharts();
  }, [loadCharts]);

  const chips = platforms.length ? platforms : FALLBACK_PLATFORMS;
  const boardChips = useMemo(
    () => [
      {
        id: "soar" as ChartBoardId,
        name: tr("charts.board.soar"),
        short: tr("charts.board.soarShort"),
        description: tr("charts.board.soarDesc"),
      },
      {
        id: "hot" as ChartBoardId,
        name: tr("charts.board.hot"),
        short: tr("charts.board.hotShort"),
        description: tr("charts.board.hotDesc"),
      },
      {
        id: "new" as ChartBoardId,
        name: tr("charts.board.new"),
        short: tr("charts.board.newShort"),
        description: tr("charts.board.newDesc"),
      },
    ],
    [tr]
  );
  // Prefer server board labels when present, else i18n fallback
  const boardsUi = boards.length
    ? boards.map((b) => {
        const fb = boardChips.find((x) => x.id === b.id);
        return {
          ...b,
          name: locale === "en" && fb ? fb.name : b.name || fb?.name || b.id,
          description:
            locale === "en" && fb
              ? fb.description
              : b.description || fb?.description,
        };
      })
    : boardChips;

  const allowedBoards = useMemo(() => {
    const meta = chips.find((p) => p.id === platform);
    const allowed = meta?.boards;
    if (!allowed?.length) return boardsUi;
    return boardsUi.filter((b) => allowed.includes(b.id));
  }, [chips, platform, boardsUi]);

  const updated =
    updatedAt > 0
      ? new Date(updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en", {
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
          <h2 className="charts-title">{metaName || tr("charts.title")}</h2>
          <button
            type="button"
            className="charts-refresh"
            disabled={loading}
            onClick={() => void loadCharts(platform, true, board)}
            title={tr("charts.refreshTitle")}
          >
            {loading ? tr("charts.loading") : tr("charts.refresh")}
          </button>
        </div>
        {desc ? <p className="charts-desc">{desc}</p> : null}
        {sourceLabel ? (
          <p className="charts-source">{tr("charts.source", { label: sourceLabel })}</p>
        ) : null}
        {platform === "douyin" ? (
          <p className="charts-hint">{tr("charts.douyinNote")}</p>
        ) : null}
        {updated ? (
          <p className="charts-updated">{tr("charts.updated", { time: updated })}</p>
        ) : null}
      </div>

      <div
        className="charts-chips charts-chips--board"
        role="tablist"
        aria-label={tr("charts.boardAria")}
        data-no-swipe
      >
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

      <div className="charts-chips" role="tablist" aria-label={tr("charts.platformAria")} data-no-swipe>
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
        <div className="empty">{tr("empty.chartsLoading")}</div>
      ) : (
        <TrackList
          tracks={tracks}
          mode="charts"
          empty={loading ? tr("empty.chartsLoading") : tr("empty.charts")}
          className="track-list charts-list"
        />
      )}
    </div>
  );
}
