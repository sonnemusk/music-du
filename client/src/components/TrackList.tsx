import * as api from "../lib/api";
import { prefetchSongResolveOne } from "../lib/resolve-prefetch";
import type { Track } from "../lib/types";
import { usePlayer } from "../store/player";
import { CoverImg } from "./CoverImg";

type Props = {
  tracks: Track[];
  mode: "search" | "playlist" | "favorites" | "history" | "charts";
  empty?: string;
  className?: string;
};

export function TrackList({ tracks, mode, empty = "暂无内容", className }: Props) {
  const playTrack = usePlayer((s) => s.playTrack);
  const curTrack = usePlayer((s) => s.curTrack);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const isFavorite = usePlayer((s) => s.isFavorite);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const addToPlaylist = usePlayer((s) => s.addToPlaylist);
  const removeFromPlaylist = usePlayer((s) => s.removeFromPlaylist);
  const removeFromHistory = usePlayer((s) => s.removeFromHistory);

  const play = (t: Track) => {
    // Single entry — do NOT also fire on double-click (would cancel resolve mid-flight)
    void playTrack(t, { from: mode });
  };

  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const warmRow = (t: Track) => {
    // Hover/focus: pre-resolve this row so click uses cached CDN URL
    prefetchSongResolveOne(
      t.id,
      (id, opts) =>
        api.resolveSong(id, {
          level: opts?.level || preferredQuality,
        }),
      preferredQuality
    );
  };

  if (!tracks.length) return <div className="empty">{empty}</div>;

  return (
    <div className={className || "track-list"}>
      {tracks.map((t, i) => {
        const active = curTrack && String(curTrack.id) === String(t.id);
        const rank = t.rank ?? (mode === "charts" ? i + 1 : 0);
        return (
          <div
            key={`${String(t.id)}-${rank || i}`}
            className={`track-row ${active ? "playing" : ""} ${active && loadingPlay ? "loading" : ""}`}
            onClick={() => play(t)}
            onMouseEnter={() => warmRow(t)}
            onFocus={() => warmRow(t)}
            role="button"
            tabIndex={0}
            title="点击播放"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                play(t);
              }
            }}
          >
            {mode === "charts" ? (
              <span
                className={`track-rank ${rank <= 3 ? `top${rank}` : ""}`}
                aria-label={`第 ${rank} 名`}
              >
                {rank}
              </span>
            ) : null}
            {t.cover ? (
              <CoverImg src={t.cover} className="cov" size="thumb" />
            ) : (
              <div className="cov" />
            )}
            <div className="track-meta">
              <div className="track-name">{t.name}</div>
              <div className="track-sub">
                {t.artist}
                {t.album ? ` · ${t.album}` : ""}
              </div>
            </div>
            <div className="track-acts" onClick={(e) => e.stopPropagation()}>
              {mode === "playlist" && (
                <button
                  type="button"
                  className="icon-btn danger"
                  title="移除"
                  onClick={() => removeFromPlaylist(t.id)}
                >
                  ✕
                </button>
              )}
              {mode === "favorites" && (
                <button
                  type="button"
                  className="icon-btn danger"
                  title="取消收藏"
                  onClick={() => toggleFavorite(t)}
                >
                  ♥
                </button>
              )}
              {mode === "history" && (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    title="加入列表"
                    onClick={() => addToPlaylist(t)}
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="从历史删除"
                    onClick={() => removeFromHistory(t.id)}
                  >
                    ✕
                  </button>
                </>
              )}
              {(mode === "search" || mode === "charts") && (
                <>
                  <button
                    type="button"
                    className="icon-btn"
                    title="加入列表"
                    onClick={() => addToPlaylist(t)}
                  >
                    ＋
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="收藏"
                    onClick={() => toggleFavorite(t)}
                  >
                    {isFavorite(t.id) ? "♥" : "♡"}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
