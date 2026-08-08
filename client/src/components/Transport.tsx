import type { CSSProperties } from "react";
import { usePlayer } from "../store/player";
import { QualityPicker } from "./QualityPicker";

/** Shared transport controls — skins style via CSS scope. */
export function Transport({ compact }: { compact?: boolean }) {
  const playing = usePlayer((s) => s.playing);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const cycleMode = usePlayer((s) => s.cycleMode);
  const modeLabel = usePlayer((s) => s.modeLabel);
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const buffered = usePlayer((s) => s.buffered);
  const playSource = usePlayer((s) => s.playSource);
  const fmt = usePlayer((s) => s.fmt);
  const seek = usePlayer((s) => s.seek);
  const setSeeking = usePlayer((s) => s.setSeeking);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const curTrack = usePlayer((s) => s.curTrack);
  const isFavorite = usePlayer((s) => s.isFavorite);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const ratio = duration > 0 ? currentTime / duration : 0;
  // Local blob / full cache always show full buffer; else clamp buffered ≥ played
  const localFull =
    /本地|blob|cache|缓存/i.test(playSource || "") || buffered >= 0.995;
  const bufRatio = localFull ? 1 : Math.max(buffered, ratio);
  const playPct = Math.round(ratio * 1000) / 10;
  const bufPct = Math.round(bufRatio * 1000) / 10;
  const volPct = Math.round((muted ? 0 : volume) * 100);

  return (
    <div className={`transport ${compact ? "compact" : ""}`}>
      {!compact && (
        <div className="transport-row" role="group" aria-label="播放控制">
          <button type="button" className="t-btn" onClick={() => next(-1)} aria-label="上一首" title="上一首 [">
            ⏮
          </button>
          <button
            type="button"
            className="t-btn play"
            onClick={togglePlay}
            aria-label="播放暂停"
            title="播放/暂停 空格"
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button type="button" className="t-btn" onClick={() => next(1)} aria-label="下一首" title="下一首 ]">
            ⏭
          </button>
          <button
            type="button"
            className="t-btn ghost mode"
            onClick={cycleMode}
            title={`${modeLabel()} · 按 L 切换`}
            aria-label={`播放模式：${modeLabel()}`}
          >
            {modeLabel()}
          </button>
          <QualityPicker />
          {curTrack && (
            <button
              type="button"
              className="t-btn ghost fav"
              onClick={() => toggleFavorite()}
              aria-label="收藏"
              title="收藏 F"
            >
              {isFavorite(curTrack.id) ? "♥" : "♡"}
            </button>
          )}
        </div>
      )}
      <div className="seek-row">
        <span aria-hidden="true">{fmt(currentTime)}</span>
        <div
          className="seek-track"
          style={
            {
              "--seek-play": `${playPct}%`,
              "--seek-buf": `${bufPct}%`,
            } as CSSProperties
          }
          data-tip={
            duration > 0
              ? `已播放 ${Math.round(playPct)}% · 已缓冲 ${Math.round(bufPct)}%`
              : undefined
          }
        >
          <div className="seek-track__rail" aria-hidden="true">
            <div className="seek-track__buffer" />
            <div className="seek-track__played" />
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            value={Math.floor(ratio * 1000)}
            onMouseDown={() => setSeeking(true)}
            onTouchStart={() => setSeeking(true)}
            onInput={(e) => seek(Number((e.target as HTMLInputElement).value) / 1000)}
            onChange={(e) => seek(Number(e.target.value) / 1000)}
            onMouseUp={() => setSeeking(false)}
            onTouchEnd={() => setSeeking(false)}
            aria-label="播放进度"
            aria-valuetext={
              duration > 0
                ? `${fmt(currentTime)} / ${fmt(duration)}，已缓冲 ${Math.round(bufPct)}%`
                : undefined
            }
          />
        </div>
        <span aria-hidden="true">{fmt(duration)}</span>
      </div>
      {!compact && (
        <div className="vol-row" role="group" aria-label="音量">
          <button
            type="button"
            className="t-btn ghost vol-mute"
            onClick={toggleMute}
            aria-label={muted ? "取消静音" : "静音"}
            title="静音 M"
          >
            {muted || volPct === 0 ? "🔇" : volPct < 40 ? "🔈" : "🔊"}
          </button>
          <input
            type="range"
            className="vol-slider"
            min={0}
            max={100}
            step={1}
            value={muted ? 0 : volPct}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            aria-label="音量"
          />
        </div>
      )}
    </div>
  );
}
