import { Transport } from "../../components/Transport";
import type { PanelTab } from "../../lib/types";
import { usePlayer } from "../../store/player";
import { SkinHead, TABS, usePanelBody } from "./shared";

export function DockLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const curTrack = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const playing = usePlayer((s) => s.playing);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playTrack = usePlayer((s) => s.playTrack);
  const playlist = usePlayer((s) => s.playlist);
  const searchResults = usePlayer((s) => s.searchResults);
  const favorites = usePlayer((s) => s.favorites);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const title = TABS.find((t) => t.id === tab)?.label || "音乐";

  return (
    <div className="layout layout-dock">
      {/* same SkinHead contract as other layouts: brand+search+tools, no second chrome */}
      <SkinHead brand={brand} tabs="none" title={title} />
      <main className="dock-main">{body}</main>
      <div className="dock-seek">
        <Transport compact />
      </div>
      <div
        className={`dock-mini ${curTrack ? "on" : ""} ${loadingPlay ? "loading" : ""}`}
        onClick={() => setTab("lyrics" as PanelTab)}
        role="button"
        tabIndex={0}
      >
        <div className="dock-mini-cov">
          {curTrack?.cover ? <img src={cover(curTrack.cover, "thumb")} alt="" /> : <span>♪</span>}
        </div>
        <div className="dock-mini-meta">
          <div className="n">{curTrack?.name || "未在播放"}</div>
          <div className="a">{loadingPlay ? "切换中…" : curTrack?.artist || "点一首歌"}</div>
        </div>
        <button
          type="button"
          className="dock-mini-play"
          onClick={(e) => {
            e.stopPropagation();
            if (curTrack) togglePlay();
            else if (favorites[0]) void playTrack(favorites[0], { from: "favorites" });
            else if (playlist[0]) void playTrack(playlist[0], { from: "playlist" });
            else if (searchResults[0]) void playTrack(searchResults[0], { from: "search" });
          }}
        >
          {playing ? "⏸" : "▶"}
        </button>
      </div>
      <nav className="dock-nav" aria-label="底部导航">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "on" : ""}
            onClick={() => setTab(t.id)}
          >
            <span>{t.short}</span>
            <span className="lbl">{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
