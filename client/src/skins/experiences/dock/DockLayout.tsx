import { useEffect, useState, type CSSProperties } from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { SearchBar } from "../../../components/SearchBar";
import { openMobileSearchFromGesture, preloadSearchOverlay } from "../../../lib/search-gesture";
import { SkinSwitcher } from "../../../components/SkinSwitcher";
import { TrackList } from "../../../components/TrackList";
import { Transport } from "../../../components/Transport";
import { loadRecentSearches } from "../../../lib/recent-searches";
import type { PanelTab } from "../../../lib/types";
import { usePlaybackClock } from "../../../store/playback-clock";
import { usePlayer } from "../../../store/player";
import { useDockT } from "./i18n";
import "./dock.css";

const PHONE_MQ = "(max-width: 720px)";
const DESKTOP_MQ = "(min-width: 1024px)";

const NAV_TABS: PanelTab[] = ["favorites", "playlist", "charts", "lyrics", "history"];

function useMq(query: string): boolean {
  const [ok, setOk] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setOk(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return ok;
}

/** Full tab copy only — never `tabs.*Short` (those are 1-glyph on zh). */
function tabLabel(tr: (k: string) => string, id: PanelTab): string {
  return tr(`tabs.${id}`);
}

function brandCore(brand: string): string {
  return brand.split("·")[0]?.trim() || brand;
}

function DockSearchPane({ tr }: { tr: (k: string, p?: Record<string, string | number>) => string }) {
  const tracks = usePlayer((s) => s.searchResults);
  const searching = usePlayer((s) => s.searching);
  const search = usePlayer((s) => s.search);
  const searchQuery = usePlayer((s) => s.searchQuery);
  const [recent, setRecent] = useState(() => loadRecentSearches());

  useEffect(() => {
    setRecent(loadRecentSearches());
  }, [searchQuery, tracks.length]);

  return (
    <div className="dock-search-pane">
      {!searching && !tracks.length ? (
        <div className="dock-recent">
          <div className="dock-recent__label">{tr("shell.recent")}</div>
          {recent.length ? (
            <div className="dock-recent__chips" data-no-swipe>
              {recent.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="dock-recent__chip"
                  onClick={() => void search(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          ) : (
            <p className="dock-recent__empty">{tr("search.recentEmpty")}</p>
          )}
        </div>
      ) : null}
      <TrackList
        tracks={tracks}
        mode="search"
        loading={searching}
        empty={tr("empty.search")}
      />
    </div>
  );
}

function DockMain({ tr }: { tr: (k: string, p?: Record<string, string | number>) => string }) {
  const tab = usePlayer((s) => s.tab);
  const favorites = usePlayer((s) => s.favorites);
  const playlist = usePlayer((s) => s.playlist);
  const history = usePlayer((s) => s.history);

  if (tab === "charts") return <ChartsPanel coverSize="thumb" />;
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  if (tab === "search") return <DockSearchPane tr={tr} />;
  if (tab === "playlist") {
    return (
      <TrackList tracks={playlist} mode="playlist" empty={tr("empty.playlist")} />
    );
  }
  if (tab === "history") {
    return <TrackList tracks={history} mode="history" empty={tr("empty.history")} />;
  }
  return (
    <TrackList tracks={favorites} mode="favorites" empty={tr("empty.favorites")} />
  );
}

export function DockLayout({ brand }: { brand: string }) {
  const locale = usePlayer((s) => s.locale);
  const tr = useDockT(locale);
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const curTrack = usePlayer((s) => s.curTrack);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const locateCurrentInList = usePlayer((s) => s.locateCurrentInList);
  const isDemoSite = usePlayer((s) => s.isDemoSite);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const playing = usePlaybackClock((c) => c.playing);
  const currentTime = usePlaybackClock((c) => c.currentTime);
  const duration = usePlaybackClock((c) => c.duration);

  const phone = useMq(PHONE_MQ);
  const desktop = useMq(DESKTOP_MQ);
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const narrow = window.matchMedia(PHONE_MQ).matches;
      // Portal search overlay cannot inherit from this tree — reserve mini + tabs.
      root.style.setProperty(
        "--search-overlay-bottom",
        narrow
          ? "calc(64px + 58px + env(safe-area-inset-bottom, 0px))"
          : "calc(72px + env(safe-area-inset-bottom, 0px))"
      );
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const playRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const openSearch = () => {
    setSheet(false);
    openMobileSearchFromGesture();
  };

  const goTab = (id: PanelTab) => {
    setTab(id);
    if (phone) setSheet(false);
  };

  const tabs = phone ? NAV_TABS : (["search", ...NAV_TABS] as PanelTab[]);

  return (
    <div
      className={`layout-dock${sheet ? " is-boarded" : ""}`}
      data-phone={phone ? "1" : undefined}
      data-desktop={desktop ? "1" : undefined}
    >
      <header className="dock-head">
        <div className="dock-brand" title={brand}>
          <span className="dock-brand__mark" aria-hidden>
            ⌁
          </span>
          <span className="dock-brand__text">{phone ? brandCore(brand) : brand}</span>
        </div>
        {phone ? (
          <button
            type="button"
            className="dock-search-launch"
            onPointerDown={() => void preloadSearchOverlay()}
            onClick={openSearch}
            aria-label={tr("shell.searchLaunch")}
          >
            ⌕
          </button>
        ) : (
          <SearchBar className="dock-search skin-search" />
        )}
        <div className="dock-tools" role="group" aria-label={tr("shell.toolsAria")}>
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </header>

      {!phone && !desktop ? (
        <nav className="dock-rail dock-rail--top" aria-label={tr("shell.navAria")}>
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              className={`dock-tab ${tab === id ? "on" : ""}`}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => goTab(id)}
            >
              {tabLabel(tr, id)}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="dock-body">
        {desktop ? (
          <nav className="dock-rail dock-rail--side" aria-label={tr("shell.railAria")}>
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                className={`dock-tab dock-tab--side ${tab === id ? "on" : ""}`}
                aria-current={tab === id ? "page" : undefined}
                onClick={() => goTab(id)}
              >
                <span className="dock-tab__full">{tabLabel(tr, id)}</span>
              </button>
            ))}
          </nav>
        ) : null}

        <main
          className="dock-main"
          data-tab={tab}
          aria-label={tr("contentAria")}
        >
          {isDemoSite ? <p className="dock-demo">{tr("demo.banner")}</p> : null}
          <DockMain tr={tr} />
        </main>
      </div>

      <footer className="dock-mini player-bar" aria-label={tr("shell.miniAria")}>
        <div
          className="dock-mini__progress"
          role="progressbar"
          aria-label={tr("shell.progressAria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(playRatio * 100)}
          style={{ "--dock-play": `${playRatio * 100}%` } as CSSProperties}
        />
        <button
          type="button"
          className="dock-mini__now"
          onClick={() => setSheet(true)}
          aria-label={tr("shell.expand")}
          title={tr("shell.slipHint")}
        >
          <CoverImg
            src={curTrack?.cover}
            className={`dock-mini__cov${playing ? " is-live" : ""}`}
            size="medium"
            priority
          />
          <span className="dock-mini__meta">
            <span className="dock-mini__title">
              {curTrack?.name || tr("shell.idle")}
            </span>
            <span className="dock-mini__sub">
              {curTrack
                ? `${curTrack.artist || ""}${loadingPlay ? ` · ${tr("nowPlaying.switching")}` : ""}`
                : tr("shell.slipHint")}
            </span>
          </span>
        </button>
        {desktop ? (
          <div className="dock-mini__seek" data-no-swipe>
            <Transport compact />
          </div>
        ) : null}
        <div className="dock-mini__acts" role="group" aria-label={tr("transport.controlsAria")}>
          <button
            type="button"
            className="dock-mini__skip"
            onClick={() => next(-1)}
            aria-label={tr("transport.prev")}
          >
            ⏮
          </button>
          <button
            type="button"
            className="dock-mini__play"
            onClick={togglePlay}
            aria-label={tr("transport.playPause")}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className="dock-mini__skip"
            onClick={() => next(1)}
            aria-label={tr("transport.next")}
          >
            ⏭
          </button>
        </div>
      </footer>

      {phone ? (
        <nav className="dock-tabs" aria-label={tr("shell.navAria")}>
          {NAV_TABS.map((id) => (
            <button
              key={id}
              type="button"
              className={`dock-tab ${tab === id ? "on" : ""}`}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => goTab(id)}
            >
              {tabLabel(tr, id)}
            </button>
          ))}
        </nav>
      ) : null}

      {sheet ? (
        <div className="dock-sheet now-playing" role="dialog" aria-modal="true" aria-label={tr("shell.sheetAria")}>
          <div className="dock-sheet__bar">
            <button
              type="button"
              className="dock-sheet__close"
              onClick={() => setSheet(false)}
              aria-label={tr("shell.collapse")}
            >
              {tr("shell.ashore")}
            </button>
            <span className="dock-sheet__hint">{tr("shell.board")}</span>
            <button
              type="button"
              className="dock-sheet__close dock-sheet__ghost"
              aria-label={tr("shell.locate")}
              onClick={() => {
                locateCurrentInList();
                setSheet(false);
              }}
            >
              {tr("shell.locate")}
            </button>
          </div>
          <div className="dock-sheet__stage">
            <div className="dock-sheet__hero">
              <div className={`dock-sheet__ring${playing ? " is-live" : ""}`}>
                <CoverImg
                  src={curTrack?.cover}
                  className="dock-sheet__cov"
                  size="full"
                  priority
                />
              </div>
              <h2 className="dock-sheet__title">{curTrack?.name || tr("shell.idle")}</h2>
              <p className="dock-sheet__artist">
                {curTrack?.artist || tr("nowPlaying.pick")}
                {curTrack?.album ? ` · ${curTrack.album}` : ""}
              </p>
              <div className="dock-sheet__transport" data-no-swipe>
                <Transport />
              </div>
              <button
                type="button"
                className="dock-sheet__lyrics-btn"
                aria-label={tr("shell.openLyrics")}
                onClick={() => {
                  setTab("lyrics");
                  if (phone) setSheet(false);
                }}
              >
                {tr("shell.openLyrics")}
              </button>
            </div>
            <div className="dock-sheet__verse">
              <LyricsView variant="split" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
