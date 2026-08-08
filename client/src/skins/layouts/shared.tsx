import type { ReactNode } from "react";
import { ChartsPanel } from "../../components/ChartsPanel";
import { CoverImg } from "../../components/CoverImg";
import { LyricsView } from "../../components/LyricsView";
import { SearchBar } from "../../components/SearchBar";
import { SkinSwitcher } from "../../components/SkinSwitcher";
import { TrackList } from "../../components/TrackList";
import { Transport } from "../../components/Transport";
import type { PanelTab } from "../../lib/types";
import { usePlayer } from "../../store/player";

export const TABS: { id: PanelTab; label: string; short: string }[] = [
  { id: "search", label: "搜索", short: "搜" },
  { id: "charts", label: "热榜", short: "热" },
  { id: "playlist", label: "列表", short: "列" },
  { id: "favorites", label: "喜欢", short: "心" },
  { id: "history", label: "历史", short: "史" },
  { id: "lyrics", label: "歌词", short: "词" },
];

export function usePanelBody() {
  const tab = usePlayer((s) => s.tab);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search")
    return <TrackList tracks={searchResults} mode="search" empty="搜索歌曲 / 歌手" />;
  if (tab === "charts") return <ChartsPanel />;
  if (tab === "playlist")
    return <TrackList tracks={playlist} mode="playlist" empty="播放列表为空" />;
  if (tab === "favorites")
    return <TrackList tracks={favorites} mode="favorites" empty="还没有收藏" />;
  if (tab === "history")
    return <TrackList tracks={history} mode="history" empty="暂无播放历史" />;
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return null;
}

export function TabNav({ short }: { short?: boolean }) {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  return (
    <nav className="skin-tabs" aria-label="内容切换">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={tab === t.id ? "on" : ""}
          onClick={() => setTab(t.id)}
        >
          {short ? t.short : t.label}
        </button>
      ))}
    </nav>
  );
}

export function NowPlaying({
  large,
  inline,
  hideBadges,
}: {
  large?: boolean;
  /** Horizontal compact strip (cover | text | badges) for player bars */
  inline?: boolean;
  hideBadges?: boolean;
}) {
  const curTrack = usePlayer((s) => s.curTrack);
  const quality = usePlayer((s) => s.quality);
  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const availableQualities = usePlayer((s) => s.availableQualities);
  const cyclePreferredQuality = usePlayer((s) => s.cyclePreferredQuality);
  const playSource = usePlayer((s) => s.playSource);
  const loadingPlay = usePlayer((s) => s.loadingPlay);

  const showBadges = !hideBadges;
  const qShow = quality && quality !== "…" ? quality : preferredQuality;
  const badges = showBadges ? (
    <div className="np-badges">
      {loadingPlay ? <span className="badge">切换中…</span> : null}
      <button
        type="button"
        className="badge badge-btn"
        onClick={cyclePreferredQuality}
        title={
          availableQualities.length
            ? `本曲可选 ${availableQualities.map((c) => c.short).join(" / ")}（点击切换）`
            : "优先最高可用音质"
        }
      >
        {String(qShow).toUpperCase()}
      </button>
      {playSource ? (
        <span className="badge">{playSource === "remote" ? "直链" : "代理"}</span>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      className={`now-playing ${large ? "lg" : ""} ${inline ? "inline" : ""} ${loadingPlay ? "loading" : ""}`}
    >
      <div className={`np-cover ${curTrack?.cover ? "has" : ""}`}>
        {curTrack?.cover ? (
          <CoverImg
            key={String(curTrack.id)}
            src={curTrack.cover}
            className="np-cover-img"
            size="medium"
            priority
          />
        ) : (
          <span>♪</span>
        )}
      </div>
      <div className="np-text">
        <h1 className="np-title">{curTrack?.name || "Music"}</h1>
        <p className="np-artist">{curTrack?.artist || "点选一首歌开始"}</p>
        {/* badges always under title — never a third flex column that floats mid-bar */}
        {badges}
      </div>
    </div>
  );
}

/**
 * Unified top chrome for ALL layouts (side / compact / split / immersive / dock).
 * Row 1: brand · search · theme tools  (never a separate global bar)
 * Row 2: tabs (optional)
 */
export function SkinHead({
  brand,
  tabs = "full",
  title,
}: {
  brand: string;
  tabs?: "full" | "short" | "none";
  /** optional title under brand row (dock style) */
  title?: string;
}) {
  // brand is usually "Music · 主题名" — split so we never show "Mu..."
  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";

  return (
    <header className="skin-head">
      <div className="skin-head__main">
        <div className="skin-brand" title={brand}>
          <span className="skin-brand__mark">{mark}</span>
          {themeName ? (
            <>
              <span className="skin-brand__sep" aria-hidden>
                ·
              </span>
              <span className="skin-brand__theme">{themeName}</span>
            </>
          ) : null}
        </div>
        <SearchBar className="skin-search" />
        <div className="skin-head__tools">
          <SkinSwitcher />
        </div>
      </div>
      {title ? <h1 className="skin-head__title">{title}</h1> : null}
      {tabs === "full" ? (
        <div className="skin-head__nav">
          <TabNav />
        </div>
      ) : null}
      {tabs === "short" ? (
        <div className="skin-head__nav">
          <TabNav short />
        </div>
      ) : null}
    </header>
  );
}

export function SkinChrome({
  brand,
  children,
}: {
  brand: string;
  children: ReactNode;
}) {
  return (
    <>
      <SkinHead brand={brand} />
      {children}
      <div className="skin-transport">
        <Transport />
      </div>
    </>
  );
}
