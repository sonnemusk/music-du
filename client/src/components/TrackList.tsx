import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import * as api from "../lib/api";
import { warmTrackCovers } from "../lib/cover-browser-cache";
import {
  VIRTUAL_LIST_MIN,
  VIRTUAL_OVERSCAN,
  VIRTUAL_ROW_H,
  visibleWindow,
} from "../lib/list-window";
import type { CoverSize } from "../lib/player-core";
import { prefetchSongResolveOne } from "../lib/resolve-prefetch";
import type { Track } from "../lib/types";
import { usePlayer } from "../store/player";
import { CoverImg } from "./CoverImg";

type Props = {
  tracks: Track[];
  mode: "search" | "playlist" | "favorites" | "history" | "charts";
  empty?: string;
  className?: string;
  loading?: boolean;
  coverSize?: CoverSize;
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

function scrollRowIntoList(el: HTMLElement) {
  const scroller = findListScroller(el);
  if (scroller) {
    const pRect = scroller.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    const delta = eRect.top + eRect.height / 2 - (pRect.top + pRect.height / 2);
    scroller.scrollTop = Math.max(0, scroller.scrollTop + delta);
    return true;
  }
  return false;
}

function flashRow(el: HTMLElement) {
  el.classList.add("track-row--flash");
  window.setTimeout(() => el.classList.remove("track-row--flash"), 900);
}

function isTouchUi() {
  return typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
}

type RowProps = {
  t: Track;
  i: number;
  mode: Props["mode"];
  active: boolean;
  loading: boolean;
  fav: boolean;
  libraryReadOnly: boolean;
  tr: (k: string, p?: Record<string, string | number>) => string;
  onPlay: (t: Track) => void;
  onToggleFav: (t: Track) => void;
  onAdd: (t: Track) => void;
  onRemovePl: (id: string | number) => void;
  onRemoveHi: (id: string | number) => void;
  onWarm: (t: Track) => void;
  setRowRef: (id: string, node: HTMLDivElement | null) => void;
  coverSize: CoverSize;
};

const TrackRow = memo(function TrackRow({
  t,
  i,
  mode,
  active,
  loading,
  fav,
  libraryReadOnly,
  tr,
  onPlay,
  onToggleFav,
  onAdd,
  onRemovePl,
  onRemoveHi,
  onWarm,
  setRowRef,
  coverSize,
}: RowProps) {
  const rank = t.rank ?? (mode === "charts" ? i + 1 : 0);
  const id = String(t.id);
  const refCb = useCallback(
    (node: HTMLDivElement | null) => setRowRef(id, node),
    [id, setRowRef]
  );

  return (
    <div
      ref={refCb}
      data-track-id={id}
      className={`track-row ${active ? "playing" : ""} ${active && loading ? "loading" : ""}`}
      onClick={() => {
        if (isTouchUi()) onPlay(t);
      }}
      onDoubleClick={() => {
        if (!isTouchUi()) onPlay(t);
      }}
      onMouseEnter={() => onWarm(t)}
      onFocus={() => onWarm(t)}
      role="group"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      aria-label={tr("track.rowAria", { name: t.name || "", artist: t.artist || "" })}
      title={isTouchUi() ? tr("track.clickPlay") : tr("track.dblPlay")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay(t);
        }
      }}
    >
      {mode === "charts" ? (
        <span
          className={`track-rank ${rank <= 3 ? `top${rank}` : ""}`}
          aria-label={tr("track.rankAria", { n: rank })}
        >
          {rank}
        </span>
      ) : null}
      {t.cover ? <CoverImg src={t.cover} className="cov" size={coverSize} /> : <div className="cov" />}
      <div className="track-meta">
        <div className="track-name">
          {t.name}
          {active && loading ? (
            <span className="track-loading-hint"> {tr("track.loading")}</span>
          ) : null}
        </div>
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
            title={tr("track.remove")}
            onClick={() => onRemovePl(t.id)}
          >
            ✕
          </button>
        )}
        {!libraryReadOnly && mode === "favorites" && (
          <button
            type="button"
            className="icon-btn danger"
            title={tr("track.unfav")}
            onClick={() => onToggleFav(t)}
          >
            ♥
          </button>
        )}
        {libraryReadOnly && mode === "favorites" && fav ? (
          <span className="icon-btn" title={tr("track.favReadonly")} aria-hidden="true">
            ♥
          </span>
        ) : null}
        {!libraryReadOnly && mode === "history" && (
          <>
            <button
              type="button"
              className="icon-btn icon-btn--secondary"
              title={tr("track.addList")}
              onClick={() => onAdd(t)}
            >
              ＋
            </button>
            <button
              type="button"
              className="icon-btn danger"
              title={tr("track.removeHistory")}
              onClick={() => onRemoveHi(t.id)}
            >
              ✕
            </button>
          </>
        )}
        {!libraryReadOnly && (mode === "search" || mode === "charts") && (
          <>
            <button
              type="button"
              className="icon-btn icon-btn--secondary"
              title={tr("track.addList")}
              onClick={() => onAdd(t)}
            >
              ＋
            </button>
            <button
              type="button"
              className="icon-btn"
              title={tr("track.fav")}
              onClick={() => onToggleFav(t)}
            >
              {fav ? "♥" : "♡"}
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export function TrackList({
  tracks,
  mode,
  empty,
  className,
  loading,
  coverSize = "thumb",
}: Props) {
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
  const locale = usePlayer((s) => s.locale);
  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const tr = useT(locale);
  const emptyText = empty ?? tr("empty.generic");
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<string | null>(null);
  const prevLocateCurIdRef = useRef<string | null>(null);
  const rowHRef = useRef(VIRTUAL_ROW_H);
  const [win, setWin] = useState({ start: 0, end: 40, padTop: 0, padBottom: 0 });
  // Grid covers (gallery) have uneven card heights — keep those fully rendered.
  const virtual = tracks.length >= VIRTUAL_LIST_MIN && coverSize === "thumb";

  const setRowRef = useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) rowRefs.current.set(id, node);
    else rowRefs.current.delete(id);
  }, []);

  const play = useCallback(
    (t: Track) => {
      void playTrack(t, { from: mode });
    },
    [playTrack, mode]
  );

  const warmRow = useCallback(
    (t: Track) => {
      void prefetchSongResolveOne(t.id, (id) =>
        api.resolveSong(id, { level: preferredQuality })
      );
    },
    [preferredQuality]
  );

  useEffect(() => {
    if (!virtual) return;
    const root = listRef.current;
    if (!root) return;
    const scroller = findListScroller(root) || root;
    const update = () => {
      const first = root.querySelector<HTMLElement>(".track-row");
      if (first?.offsetHeight) rowHRef.current = first.offsetHeight;
      setWin(
        visibleWindow({
          length: tracks.length,
          scrollTop: scroller.scrollTop,
          viewportH: scroller.clientHeight || 480,
          rowH: rowHRef.current,
          overscan: VIRTUAL_OVERSCAN,
        })
      );
    };
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      ro?.disconnect();
    };
  }, [virtual, tracks.length, mode]);

  // F-3: warm covers near viewport only
  useEffect(() => {
    const root = listRef.current;
    if (!root || !tracks.length) return;
    const slice = virtual ? tracks.slice(win.start, win.end) : tracks.slice(0, 24);
    warmTrackCovers(slice, 24);
    const io = new IntersectionObserver(
      (entries) => {
        const need: Track[] = [];
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const id = (en.target as HTMLElement).dataset.trackId;
          const hit = tracks.find((x) => String(x.id) === id);
          if (hit) need.push(hit);
        }
        if (need.length) warmTrackCovers(need, 40);
      },
      { root: findListScroller(root) || null, rootMargin: "120px 0px", threshold: 0.01 }
    );
    root.querySelectorAll<HTMLElement>("[data-track-id]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [tracks, mode, virtual, win.start, win.end]);

  useEffect(() => {
    const prev = prevModeRef.current;
    const enteredFavorites = mode === "favorites" && prev !== "favorites";
    prevModeRef.current = mode;

    const curId = curTrack ? String(curTrack.id) : null;
    const curChanged = Boolean(curId && curId !== prevLocateCurIdRef.current);
    const inList = (id: string) => tracks.some((t) => String(t.id) === id);

    let wantId: string | null = null;
    if (mode === "favorites" && curId && inList(curId) && curChanged) {
      wantId = curId;
    }
    if (!wantId && locateRequest?.id && inList(locateRequest.id)) {
      if (!curId || locateRequest.id === curId || mode !== "favorites") {
        wantId = locateRequest.id;
      }
    }
    if (enteredFavorites && !wantId && curId && inList(curId)) {
      wantId = curId;
    }
    if (curId) prevLocateCurIdRef.current = curId;
    if (!wantId) return;
    const idx = tracks.findIndex((t) => String(t.id) === wantId);
    if (virtual && idx >= 0) {
      const root = listRef.current;
      const scroller = root ? findListScroller(root) : null;
      if (scroller) {
        const h = rowHRef.current || VIRTUAL_ROW_H;
        scroller.scrollTop = Math.max(0, idx * h - scroller.clientHeight / 2 + h / 2);
      }
    }
    const reveal = () => {
      const el = rowRefs.current.get(wantId);
      if (el) {
        scrollRowIntoList(el);
        flashRow(el);
      }
    };
    reveal();
    requestAnimationFrame(reveal);
  }, [mode, curTrack, locateRequest, tracks, virtual]);

  if (loading) {
    return (
      <div className={className || "track-list"} aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="track-row track-row--skel" aria-hidden />
        ))}
      </div>
    );
  }

  if (!tracks.length) {
    return (
      <div className={className || "track-list"}>
        <div className="empty">
          <p>{emptyText}</p>
        </div>
      </div>
    );
  }

  const start = virtual ? win.start : 0;
  const end = virtual ? win.end : tracks.length;
  const slice = tracks.slice(start, end);

  return (
    <div className={className || "track-list"} ref={listRef} data-virtual={virtual ? "1" : undefined}>
      {virtual ? <div className="track-list__pad" style={{ height: win.padTop }} aria-hidden /> : null}
      {slice.map((t, offset) => {
        const i = start + offset;
        return (
          <TrackRow
            key={mode === "charts" && t.rank ? `${String(t.id)}-${t.rank}` : String(t.id)}
            t={t}
            i={i}
            mode={mode}
            active={Boolean(curTrack && String(curTrack.id) === String(t.id))}
            loading={Boolean(loadingPlay && curTrack && String(curTrack.id) === String(t.id))}
            fav={isFavorite(t.id)}
            libraryReadOnly={libraryReadOnly}
            tr={tr}
            onPlay={play}
            onToggleFav={toggleFavorite}
            onAdd={addToPlaylist}
            onRemovePl={removeFromPlaylist}
            onRemoveHi={removeFromHistory}
            onWarm={warmRow}
            setRowRef={setRowRef}
            coverSize={coverSize}
          />
        );
      })}
      {virtual ? <div className="track-list__pad" style={{ height: win.padBottom }} aria-hidden /> : null}
    </div>
  );
}
