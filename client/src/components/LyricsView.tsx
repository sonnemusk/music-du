import { useEffect, useLayoutEffect, useRef } from "react";
import { useT } from "../i18n";
import { lyricIndexAt } from "../lib/player-core";
import { usePlayer } from "../store/player";

type Props = {
  /** panel = 主内容区歌词 tab；split = 分栏布局内嵌歌词 */
  variant?: "panel" | "split";
  empty?: string;
};

/**
 * Resolve which element actually scrolls.
 * Prefer the lyrics root when it can scroll; else nearest overflow ancestor.
 */
function pickScrollContainer(root: HTMLElement): HTMLElement {
  if (root.scrollHeight > root.clientHeight + 4) return root;
  let p: HTMLElement | null = root.parentElement;
  while (p && p !== document.body) {
    const style = getComputedStyle(p);
    const oy = style.overflowY;
    if (
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      p.scrollHeight > p.clientHeight + 4
    ) {
      return p;
    }
    p = p.parentElement;
  }
  return root;
}

/** Scroll so `line` is vertically centered inside `scroller`. */
function centerLine(
  scroller: HTMLElement,
  line: HTMLElement,
  behavior: ScrollBehavior
) {
  const scrollerH = scroller.clientHeight;
  if (scrollerH < 8) return;

  // Position of line relative to scroller content (works even with spacers)
  const sRect = scroller.getBoundingClientRect();
  const lRect = line.getBoundingClientRect();
  const lineCenter = lRect.top - sRect.top + scroller.scrollTop + lRect.height / 2;
  const target = Math.max(0, lineCenter - scrollerH / 2);
  const maxScroll = Math.max(0, scroller.scrollHeight - scrollerH);
  const next = Math.min(maxScroll, target);

  if (Math.abs(scroller.scrollTop - next) < 4) return;

  try {
    scroller.scrollTo({ top: next, behavior });
  } catch {
    scroller.scrollTop = next;
  }
}

/**
 * Auto-scrolling lyrics: active line stays roughly centered.
 * Manual scroll/touch pauses follow for a few seconds so users can browse.
 * Works across all layouts by filling parent height + robust scroll pick.
 */
export function LyricsView({
  variant = "panel",
  empty,
}: Props) {
  const lyrics = usePlayer((s) => s.lyrics);
  const lyricIdx = usePlayer((s) => s.lyricIdx);
  const audioEl = usePlayer((s) => s.audioEl);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const emptyText = empty ?? tr("empty.lyrics");

  const scrollerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  /** Until this timestamp, do not auto-scroll (user is browsing). */
  const pauseUntilRef = useRef(0);
  const lastSongKey = useRef("");
  const lastCenteredIdx = useRef(-999);

  const songKey = lyrics.length
    ? `${lyrics[0]?.ms}-${lyrics.length}-${lyrics[lyrics.length - 1]?.ms}`
    : "";

  // Ensure scroller fills parent height so it can actually scroll (all layouts)
  useLayoutEffect(() => {
    const root = scrollerRef.current;
    if (!root || !lyrics.length) return;
    const parent = root.parentElement;
    if (!parent) return;

    // If parent is a flex child with min-height 0, flex:1 on root is enough via CSS.
    // Fallback: cap root to parent client height so internal scroll works.
    const ph = parent.clientHeight;
    if (ph > 48) {
      root.style.maxHeight = `${ph}px`;
      if (root.clientHeight < 48 && getComputedStyle(parent).display !== "flex") {
        root.style.height = `${ph}px`;
      }
    }
  }, [lyrics, songKey, variant]);

  // New song → jump to top, clear pause
  useEffect(() => {
    if (songKey === lastSongKey.current) return;
    lastSongKey.current = songKey;
    pauseUntilRef.current = 0;
    lastCenteredIdx.current = -999;
    const root = scrollerRef.current;
    if (root) root.scrollTop = 0;
  }, [songKey]);

  // When lyrics first appear mid-song, snap index once (tick() owns ongoing lyricIdx)
  useEffect(() => {
    if (!lyrics.length) return;
    const audio = audioEl || usePlayer.getState().audioEl;
    const t = audio?.currentTime ?? 0;
    const idx = lyricIndexAt(lyrics, t * 1000);
    if (idx !== usePlayer.getState().lyricIdx) {
      usePlayer.setState({ lyricIdx: idx });
    }
  }, [songKey, lyrics, audioEl]);

  // Follow active line → center
  useLayoutEffect(() => {
    if (lyricIdx < 0 || !lyrics.length) return;
    if (Date.now() < pauseUntilRef.current) return;

    const root = scrollerRef.current;
    const line = lineRefs.current.get(lyricIdx);
    if (!root || !line) return;

    const scroller = pickScrollContainer(root);
    const prefersReduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // First paint / large jumps: auto; sequential lines: smooth
    const jump = Math.abs(lyricIdx - lastCenteredIdx.current) > 2;
    const behavior: ScrollBehavior =
      prefersReduce || jump || lastCenteredIdx.current < 0 ? "auto" : "smooth";

    // Double rAF so layout (flex height) settles after theme/layout switch
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        centerLine(scroller, line, behavior);
        lastCenteredIdx.current = lyricIdx;
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [lyricIdx, songKey, lyrics.length]);

  // Re-center on resize / layout change (theme switch, rotate)
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (Date.now() < pauseUntilRef.current) return;
      const line = lineRefs.current.get(usePlayer.getState().lyricIdx);
      if (!line) return;
      centerLine(pickScrollContainer(root), line, "auto");
    });
    ro.observe(root);
    if (root.parentElement) ro.observe(root.parentElement);
    return () => ro.disconnect();
  }, [songKey]);

  const markUserBrowse = () => {
    pauseUntilRef.current = Date.now() + 4500;
  };

  const seekToLine = (ms: number) => {
    const audio = audioEl || usePlayer.getState().audioEl;
    if (!audio || !audio.src) return;
    const t = Math.max(0, ms / 1000);
    try {
      audio.currentTime = t;
    } catch {
      /* */
    }
    const idx = lyricIndexAt(lyrics, ms);
    usePlayer.setState({ currentTime: t, lyricIdx: idx });
    // Resume follow shortly after intentional seek
    pauseUntilRef.current = Date.now() + 300;
    lastCenteredIdx.current = -999; // force re-center
  };

  if (!lyrics.length) {
    return (
      <div className="empty">
        {emptyText}
        <div className="lyrics-empty-hint">
          {tr("lyrics.loading")}
          <br />
          {tr("lyrics.loadingHint")}
        </div>
      </div>
    );
  }

  const cls =
    variant === "split"
      ? "split-lyrics lyrics-scroller"
      : "lyrics-panel lyrics-scroller";

  return (
    <div
      ref={scrollerRef}
      className={cls}
      role="list"
      aria-label={tr("lyrics.aria")}
      onWheel={markUserBrowse}
      onTouchStart={markUserBrowse}
      onPointerDown={(e) => {
        if (e.pointerType === "touch" || e.pointerType === "pen") markUserBrowse();
      }}
    >
      <div className="lyrics-spacer" aria-hidden />
      {lyrics.map((l, i) => (
        <button
          key={`${l.ms}-${i}`}
          type="button"
          role="listitem"
          className={`ly ${i === lyricIdx ? "on" : ""}`}
          ref={(el) => {
            if (el) lineRefs.current.set(i, el);
            else lineRefs.current.delete(i);
          }}
          onClick={() => seekToLine(l.ms)}
          title={tr("lyrics.jumpTitle")}
        >
          <span className="ly-orig">{l.orig}</span>
          {l.tran ? <span className="tr">{l.tran}</span> : null}
        </button>
      ))}
      <div className="lyrics-spacer" aria-hidden />
    </div>
  );
}
