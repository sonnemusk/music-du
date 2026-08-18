import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { SearchBar } from "../../../components/SearchBar";
import { openMobileSearchFromGesture, preloadSearchOverlay } from "../../../lib/search-gesture";
import { SkinSwitcher } from "../../../components/SkinSwitcher";
import { TrackList } from "../../../components/TrackList";
import { Transport } from "../../../components/Transport";
import { useT } from "../../../i18n";
import { isMobileSearchUi } from "../../../lib/mobile-ui";
import type { Track } from "../../../lib/types";
import { useLyricIdx } from "../../../store/lyric-clock";
import { usePlaybackClock } from "../../../store/playback-clock";
import { usePlayer } from "../../../store/player";
import { feedT } from "./i18n";
import { feedThemeToCssVars, getFeedTheme } from "./theme";
import "./feed.css";

const SITE_QUEUES = ["favorites", "history", "playlist", "charts"] as const;
type SiteQueue = (typeof SITE_QUEUES)[number];
type DockKind = "queue" | "lyrics" | "search";

const SWIPE_MIN_DY = 56;
const SWIPE_DY_OVER_DX = 1.25;

function isSiteQueue(v: string): v is SiteQueue {
  return (SITE_QUEUES as readonly string[]).includes(v);
}

function tracksFor(
  src: SiteQueue,
  lists: {
    favorites: Track[];
    history: Track[];
    playlist: Track[];
    chartTracks: Track[];
  }
): Track[] {
  if (src === "favorites") return lists.favorites;
  if (src === "history") return lists.history;
  if (src === "playlist") return lists.playlist;
  return lists.chartTracks;
}

function chipKey(src: SiteQueue): "queueFavorites" | "queueHistory" | "queuePlaylist" | "queueCharts" {
  if (src === "favorites") return "queueFavorites";
  if (src === "history") return "queueHistory";
  if (src === "playlist") return "queuePlaylist";
  return "queueCharts";
}

function ignoreSwipeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("[data-no-swipe]"));
}

function useMobileChrome() {
  const [mobile, setMobile] = useState(() => isMobileSearchUi());
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return mobile;
}

function neighborAt(list: Track[], cur: Track | null, delta: -1 | 1): Track | null {
  if (!list.length) return null;
  const i = cur ? list.findIndex((t) => String(t.id) === String(cur.id)) : -1;
  if (i < 0) return delta > 0 ? list[0]! : list[list.length - 1]!;
  const next = (i + delta + list.length) % list.length;
  const hit = list[next];
  if (!hit || String(hit.id) === String(cur?.id)) return null;
  return hit;
}

function FeedCover({ track, size }: { track: Track | null; size: "full" | "medium" }) {
  if (!track?.cover) {
    return (
      <span className="feed-card__note" aria-hidden>
        ♪
      </span>
    );
  }
  return <CoverImg key={`${size}-${String(track.id)}`} src={track.cover} size={size} priority={size === "full"} />;
}

export function FeedLayout({ brand }: { brand: string }) {
  const mobile = useMobileChrome();
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const ft = useCallback((key: Parameters<typeof feedT>[1]) => feedT(locale, key), [locale]);

  const skin = usePlayer((s) => s.skin);
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const queueSource = usePlayer((s) => s.queueSource);
  const curTrack = usePlayer((s) => s.curTrack);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);
  const playlist = usePlayer((s) => s.playlist);
  const chartTracks = usePlayer((s) => s.chartTracks);
  const searchResults = usePlayer((s) => s.searchResults);
  const lyrics = usePlayer((s) => s.lyrics);
  const lyricIdx = useLyricIdx();
  const next = usePlayer((s) => s.next);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playTrack = usePlayer((s) => s.playTrack);
  const loadCharts = usePlayer((s) => s.loadCharts);
  const coverUrl = usePlayer((s) => s.cover);
  const playing = usePlaybackClock((c) => c.playing);

  const lists = useMemo(
    () => ({ favorites, history, playlist, chartTracks }),
    [favorites, history, playlist, chartTracks]
  );

  const activeSrc: SiteQueue = isSiteQueue(queueSource) ? queueSource : "favorites";
  const queueTracks = tracksFor(activeSrc, lists);
  const qIdx = curTrack
    ? queueTracks.findIndex((t) => String(t.id) === String(curTrack.id))
    : -1;
  const prevTrack = neighborAt(queueTracks, curTrack, -1);
  const nextTrack = neighborAt(queueTracks, curTrack, 1);

  const feedTheme = getFeedTheme(skin);
  const vars = feedThemeToCssVars(feedTheme);

  const [dock, setDock] = useState<DockKind>("queue");
  const [sheetOpen, setSheetOpen] = useState(false);

  const dragRef = useRef({ x: 0, y: 0, id: -1, tracking: false });
  const [dragY, setDragY] = useState(0);
  const wheelLock = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--search-overlay-bottom",
      "max(168px, calc(env(safe-area-inset-bottom, 0px) + 148px))"
    );
    return () => {
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, []);

  useEffect(() => {
    if (queueSource !== "search") return;
    const id = curTrack ? String(curTrack.id) : "";
    const order: SiteQueue[] = ["favorites", "playlist", "charts", "history"];
    const hit = order.find((src) =>
      id ? tracksFor(src, lists).some((t) => String(t.id) === id) : false
    );
    usePlayer.setState({ queueSource: hit ?? "history" });
  }, [queueSource, curTrack, lists]);

  useEffect(() => {
    if (tab !== "search" || mobile) return;
    setDock("search");
  }, [tab, mobile]);

  const selectQueue = useCallback(
    (src: SiteQueue) => {
      setTab(src);
      setDock("queue");
      if (mobile) setSheetOpen(true);
      if (src === "charts") void loadCharts();
      const st = usePlayer.getState();
      const list = tracksFor(src, {
        favorites: st.favorites,
        history: st.history,
        playlist: st.playlist,
        chartTracks: st.chartTracks,
      });
      const cur = st.curTrack;
      const same = cur && list.some((t) => String(t.id) === String(cur.id));
      if (same || !list[0]) {
        usePlayer.setState({ queueSource: src });
        return;
      }
      void playTrack(list[0], { from: src });
    },
    [loadCharts, mobile, playTrack, setTab]
  );

  const openLyrics = useCallback(() => {
    setTab("lyrics");
    setDock("lyrics");
    if (mobile) setSheetOpen(true);
  }, [mobile, setTab]);

  const openQueue = useCallback(() => {
    setTab(activeSrc);
    setDock("queue");
    if (mobile) setSheetOpen(true);
  }, [activeSrc, mobile, setTab]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (ignoreSwipeTarget(e.target)) return;
    dragRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, tracking: true };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.tracking || e.pointerId !== dragRef.current.id) return;
    const dy = e.clientY - dragRef.current.y;
    const dx = e.clientX - dragRef.current.x;
    if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) setDragY(dy);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.tracking || e.pointerId !== dragRef.current.id) return;
    dragRef.current.tracking = false;
    const dy = e.clientY - dragRef.current.y;
    const dx = e.clientX - dragRef.current.x;
    setDragY(0);
    if (Math.abs(dy) < SWIPE_MIN_DY) return;
    if (Math.abs(dy) <= SWIPE_DY_OVER_DX * Math.abs(dx)) return;
    next(dy < 0 ? 1 : -1);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== dragRef.current.id) return;
    dragRef.current.tracking = false;
    setDragY(0);
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (ignoreSwipeTarget(e.target)) return;
    if (Math.abs(e.deltaY) < 24) return;
    const now = Date.now();
    if (now < wheelLock.current) return;
    wheelLock.current = now + 480;
    next(e.deltaY > 0 ? 1 : -1);
  };

  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";
  const line = lyricIdx >= 0 ? lyrics[lyricIdx] : undefined;
  const fullBg = curTrack?.cover ? coverUrl(curTrack.cover, "full") : "";
  const indexRatio =
    qIdx >= 0 && queueTracks.length > 0 ? (qIdx + 1) / queueTracks.length : 0;

  const stackStyle = {
    transform: `translate3d(0, calc(-33.333% + ${dragY}px), 0)`,
    transition: dragY === 0 ? "transform 0.28s cubic-bezier(.22,.8,.28,1)" : "none",
  } as CSSProperties;

  let dockBody;
  if (dock === "lyrics") {
    dockBody = <LyricsView variant="panel" />;
  } else if (dock === "search") {
    dockBody = (
      <TrackList
        tracks={searchResults}
        mode="search"
        empty={tr("empty.search")}
        coverSize="medium"
      />
    );
  } else if (activeSrc === "charts") {
    dockBody = <ChartsPanel coverSize="medium" />;
  } else {
    dockBody = (
      <TrackList
        tracks={queueTracks}
        mode={activeSrc}
        empty={tr(`empty.${activeSrc}`)}
        coverSize="medium"
      />
    );
  }

  return (
    <div
      className="layout-feed"
      data-feed-theme={feedTheme.id}
      data-mobile={mobile ? "1" : undefined}
      data-sheet={mobile && sheetOpen ? "1" : undefined}
      style={{
        ...(vars as CSSProperties),
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      {fullBg ? (
        <div className="feed-wash" style={{ backgroundImage: `url(${fullBg})` }} aria-hidden />
      ) : null}
      <div className="feed-wash__veil" aria-hidden />

      <header className="feed-chrome" data-no-swipe>
        <div className="feed-chrome__row">
          <div className="feed-brand" title={brand}>
            <span className="feed-brand__mark">{mark}</span>
            {themeName ? <span className="feed-brand__theme">{themeName}</span> : null}
          </div>
          {mobile ? (
            <button
              type="button"
              className="feed-search-launch"
              aria-label={ft("searchLaunch")}
              title={ft("searchLaunch")}
              onPointerDown={() => void preloadSearchOverlay()}
              onClick={() => openMobileSearchFromGesture()}
            >
              <span aria-hidden>🔍</span>
            </button>
          ) : (
            <SearchBar className="feed-search" />
          )}
          <div className="feed-chrome__tools">
            <LocaleSwitcher />
            <SkinSwitcher />
          </div>
        </div>
        <div className="feed-chips" role="tablist" aria-label={ft("queueAria")}>
          {SITE_QUEUES.map((src) => (
            <button
              key={src}
              type="button"
              role="tab"
              className={`feed-chip ${activeSrc === src && dock !== "lyrics" && dock !== "search" ? "on" : ""}`}
              aria-selected={activeSrc === src && dock !== "lyrics"}
              onClick={() => selectQueue(src)}
            >
              {ft(chipKey(src))}
            </button>
          ))}
          <button
            type="button"
            className={`feed-chip ${dock === "lyrics" ? "on" : ""}`}
            aria-pressed={dock === "lyrics"}
            onClick={openLyrics}
          >
            {ft("lyrics")}
          </button>
          {mobile ? (
            <button
              type="button"
              className={`feed-chip ${sheetOpen && dock === "queue" ? "on" : ""}`}
              aria-pressed={sheetOpen && dock === "queue"}
              onClick={openQueue}
            >
              {ft("queue")}
            </button>
          ) : null}
        </div>
      </header>

      <div className="feed-body">
        {mobile && sheetOpen ? (
          <button
            type="button"
            className="feed-sheet-scrim"
            aria-label={ft("closePanel")}
            onClick={() => setSheetOpen(false)}
          />
        ) : null}
        <section className="feed-stage">
          <div
            className="feed-reel"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onWheel={onWheel}
          >
            <div className="feed-reel__stack" style={stackStyle}>
              <article className="feed-card feed-card--ghost">
                <FeedCover track={prevTrack} size="medium" />
              </article>
              <article className="feed-card feed-card--now" aria-live="polite">
                <FeedCover track={curTrack} size="full" />
                <div className="feed-card__notch feed-card__notch--l" aria-hidden />
                <div className="feed-card__notch feed-card__notch--r" aria-hidden />
                <div className="feed-card__grain" aria-hidden />
                <div className="feed-card__veil" />
                <div className="feed-card__meta">
                  <p className="feed-card__kicker">{ft("nowPlaying")}</p>
                  <h1 className="feed-card__title">{curTrack?.name || tr("nowPlaying.pick")}</h1>
                  <p className="feed-card__artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
                  <button
                    type="button"
                    className="feed-caption"
                    data-no-swipe
                    onClick={openLyrics}
                  >
                    {line?.orig || ft("swipeHint")}
                  </button>
                </div>
              </article>
              <article className="feed-card feed-card--ghost">
                <FeedCover track={nextTrack} size="medium" />
              </article>
            </div>

            <div
              className="feed-index"
              role="meter"
              aria-label={ft("indexAria")}
              aria-valuemin={1}
              aria-valuemax={Math.max(1, queueTracks.length)}
              aria-valuenow={qIdx >= 0 ? qIdx + 1 : 0}
            >
              <span className="feed-index__fill" style={{ height: `${Math.round(indexRatio * 100)}%` }} />
            </div>
          </div>

          <div className="feed-deck" data-no-swipe>
            <div className="feed-skips" role="group" aria-label={ft("navAria")}>
              <button
                type="button"
                className="feed-skip"
                aria-label={ft("prevTrack")}
                title={ft("prevTrack")}
                onClick={() => next(-1)}
              >
                <span aria-hidden>▲</span>
              </button>
              <button
                type="button"
                className="feed-skip feed-skip--play"
                aria-label={ft("playPause")}
                title={ft("playPause")}
                onClick={() => togglePlay()}
              >
                <span aria-hidden>{playing ? "⏸" : "▶"}</span>
              </button>
              <button
                type="button"
                className="feed-skip"
                aria-label={ft("nextTrack")}
                title={ft("nextTrack")}
                onClick={() => next(1)}
              >
                <span aria-hidden>▼</span>
              </button>
            </div>
            <div className="feed-transport">
              <Transport />
            </div>
          </div>
        </section>

        <aside className="feed-dock" data-no-swipe>
          <div className="feed-dock__bar">
            <h2 className="feed-dock__title">
              {dock === "lyrics"
                ? ft("lyrics")
                : dock === "search"
                  ? tr("tabs.search")
                  : ft(chipKey(activeSrc))}
            </h2>
            {mobile ? (
              <button
                type="button"
                className="feed-sheet-close"
                aria-label={ft("closePanel")}
                onClick={() => setSheetOpen(false)}
              >
                ×
              </button>
            ) : null}
          </div>
          <div className="feed-dock__body">{dockBody}</div>
        </aside>
      </div>
    </div>
  );
}
