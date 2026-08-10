import { useEffect, useRef } from "react";
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

/** Pick the most roomy scrollable ancestor (list panel), never document/body. */
function findListScroller(el: HTMLElement): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestRoom = 0;
  let parent: HTMLElement | null = el.parentElement;
  while (parent && parent !== document.documentElement && parent !== document.body) {
    const st = getComputedStyle(parent);
    const oy = st.overflowY;
    const overflow = st.overflow;
    const yOk =
      oy === "auto" ||
      oy === "scroll" ||
      oy === "overlay" ||
      overflow === "auto" ||
      overflow === "scroll";
    if (yOk) {
      const room = parent.scrollHeight - parent.clientHeight;
      if (room > bestRoom) {
        bestRoom = room;
        best = parent;
      }
    }
    parent = parent.parentElement;
  }
  return bestRoom > 2 ? best : null;
}

/** Scroll row to vertical center of list scroller — no layout shell jump. */
function scrollRowIntoList(el: HTMLElement) {
  const scroller = findListScroller(el);
  if (scroller) {
    const pRect = scroller.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.top + eRect.height / 2 - (pRect.top + pRect.height / 2);
    // Instant jump is more reliable than smooth when list just mounted
    scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
    return true;
  }
  return false;
}

function flashRow(el: HTMLElement) {
  el.classList.add("track-row--flash");
  window.setTimeout(() => el.classList.remove("track-row--flash"), 900);
}

export function TrackList({ tracks, mode, empty = "暂无内容", className }: Props) {
  const playTrack = usePlayer((s) => s.playTrack);
  const curTrack = usePlayer((s) => s.curTrack);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const locateRequest = usePlayer((s) => s.locateRequest);
  const isFavorite = usePlayer((s) => s.isFavorite);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const addToPlaylist = usePlayer((s) => s.addToPlaylist);
  const removeFromPlaylist = usePlayer((s) => s.removeFromPlaylist);
  const removeFromHistory = usePlayer((s) => s.removeFromHistory);
  const libraryReadOnly = usePlayer((s) => s.libraryReadOnly);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  /** Track previous mode so we detect entering 喜欢 (including first mount). */
  const prevModeRef = useRef<string | null>(null);
  /** Last curTrack we auto-located — next/prev while on 喜欢 should re-scroll. */
  const prevLocateCurIdRef = useRef<string | null>(null);

  // Locate: playing track always wins on 喜欢 when curTrack changes (next/prev).
  // locateRequest (G key) only when it matches current play or no cur change.
  useEffect(() => {
    const prev = prevModeRef.current;
    const enteredFavorites = mode === "favorites" && prev !== "favorites";
    prevModeRef.current = mode;

    const curId = curTrack ? String(curTrack.id) : null;
    const curChanged = Boolean(curId && curId !== prevLocateCurIdRef.current);
    const inList = (id: string) => tracks.some((t) => String(t.id) === id);

    let wantId: string | null = null;

    // 1) Next/prev / auto-advance: always follow playing track on 喜欢
    if (mode === "favorites" && curId && inList(curId) && curChanged) {
      wantId = curId;
    }

    // 2) Explicit G / locateRequest — only if still relevant to current play
    if (!wantId && locateRequest?.id) {
      const id = String(locateRequest.id);
      if (inList(id) && (!curId || id === curId || !curChanged)) {
        wantId = id;
      }
    }

    // 3) Enter 喜欢 tab: jump to playing track if present
    if (
      !wantId &&
      mode === "favorites" &&
      curId &&
      inList(curId) &&
      (enteredFavorites || prev === null)
    ) {
      wantId = curId;
    }

    if (!wantId) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~2s with 50ms steps
    const targetId = wantId;

    const run = () => {
      if (cancelled) return;
      // Always prefer live playing id on 喜欢 (next may advance during retries)
      const livePlaying =
        mode === "favorites" ? usePlayer.getState().curTrack : null;
      const liveId = livePlaying ? String(livePlaying.id) : targetId;
      const id =
        mode === "favorites" && liveId && inList(liveId) ? liveId : targetId;
      const el = rowRefs.current.get(id);
      if (!el) {
        if (attempts++ < maxAttempts) {
          window.setTimeout(run, 50);
        }
        return;
      }
      const ok = scrollRowIntoList(el);
      flashRow(el);
      // Only mark located after we actually found the row
      if (mode === "favorites") {
        prevLocateCurIdRef.current = id;
      }
      if (!ok || attempts < 2) {
        attempts++;
        window.setTimeout(() => {
          if (cancelled) return;
          const still = usePlayer.getState().curTrack;
          const againId =
            mode === "favorites" && still && inList(String(still.id))
              ? String(still.id)
              : id;
          const again = rowRefs.current.get(againId);
          if (again) {
            scrollRowIntoList(again);
            flashRow(again);
            if (mode === "favorites") prevLocateCurIdRef.current = againId;
          }
        }, 120);
      }
    };

    const t = window.setTimeout(run, 40);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [mode, locateRequest?.id, locateRequest?.nonce, curTrack?.id, tracks.length]);

  const play = (t: Track) => {
    void playTrack(t, { from: mode });
  };

  /** Touch / coarse pointer: single tap plays. Mouse: double-click (avoids accidental play). */
  const isTouchUi = () => {
    try {
      if (typeof window === "undefined") return false;
      if (window.matchMedia?.("(pointer: coarse)").matches) return true;
      if (navigator.maxTouchPoints > 0) return true;
    } catch {
      /* */
    }
    return false;
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

  if (!tracks.length) {
    return (
      <div className={className || "track-list"}>
        <div className="empty">{empty}</div>
      </div>
    );
  }

  return (
    <div className={className || "track-list"}>
      {tracks.map((t, i) => {
        const active = curTrack && String(curTrack.id) === String(t.id);
        const rank = t.rank ?? (mode === "charts" ? i + 1 : 0);
        return (
          <div
            key={`${String(t.id)}-${rank || i}`}
            ref={(node) => {
              const k = String(t.id);
              if (node) rowRefs.current.set(k, node);
              else rowRefs.current.delete(k);
            }}
            data-track-id={String(t.id)}
            className={`track-row ${active ? "playing" : ""} ${active && loadingPlay ? "loading" : ""}`}
            onClick={() => {
              if (isTouchUi()) play(t);
            }}
            onDoubleClick={() => {
              if (!isTouchUi()) play(t);
            }}
            onMouseEnter={() => warmRow(t)}
            onFocus={() => warmRow(t)}
            role="button"
            tabIndex={0}
            title={isTouchUi() ? "点击播放" : "双击播放"}
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
              {!libraryReadOnly && mode === "playlist" && (
                <button
                  type="button"
                  className="icon-btn danger"
                  title="移除"
                  onClick={() => removeFromPlaylist(t.id)}
                >
                  ✕
                </button>
              )}
              {!libraryReadOnly && mode === "favorites" && (
                <button
                  type="button"
                  className="icon-btn danger"
                  title="取消收藏"
                  onClick={() => toggleFavorite(t)}
                >
                  ♥
                </button>
              )}
              {libraryReadOnly && mode === "favorites" && isFavorite(t.id) ? (
                <span className="icon-btn" title="已收藏（只读）" aria-hidden="true">
                  ♥
                </span>
              ) : null}
              {!libraryReadOnly && mode === "history" && (
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
              {!libraryReadOnly && (mode === "search" || mode === "charts") && (
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
