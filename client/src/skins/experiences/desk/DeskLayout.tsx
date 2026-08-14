import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { QualityPicker } from "../../../components/QualityPicker";
import { SearchBar } from "../../../components/SearchBar";
import { openMobileSearchFromGesture } from "../../../components/SearchOverlay";
import { SkinSwitcher } from "../../../components/SkinSwitcher";
import { TrackList } from "../../../components/TrackList";
import { Transport } from "../../../components/Transport";
import { useT } from "../../../i18n";
import { loadRecentSearches } from "../../../lib/recent-searches";
import { qualityShortLabel } from "../../../lib/quality";
import type { PanelTab } from "../../../lib/types";
import { usePlaybackClock } from "../../../store/playback-clock";
import { usePlayer } from "../../../store/player";
import { useDeskText } from "./i18n";
import { deskThemeVars, getDeskTheme } from "./theme";
import "./desk.css";

const NAV: PanelTab[] = ["search", "charts", "favorites", "playlist", "history", "lyrics"];
const FOOT: PanelTab[] = ["charts", "favorites", "playlist", "history", "lyrics"];

function readDeskViewport() {
  if (typeof window === "undefined") return { mobile: false, compact: false };
  return {
    mobile: window.matchMedia("(max-width: 720px)").matches,
    compact: window.matchMedia("(max-width: 1024px)").matches,
  };
}

function useDeskViewport() {
  const [vp, setVp] = useState(readDeskViewport);
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 720px)");
    const tab = window.matchMedia("(max-width: 1024px)");
    const apply = () =>
      setVp({ mobile: phone.matches, compact: tab.matches });
    apply();
    phone.addEventListener?.("change", apply);
    tab.addEventListener?.("change", apply);
    return () => {
      phone.removeEventListener?.("change", apply);
      tab.removeEventListener?.("change", apply);
    };
  }, []);
  return vp;
}

function tabLabel(tr: (k: string) => string, id: PanelTab, short: boolean) {
  return short ? tr(`tabs.${id}Short`) : tr(`tabs.${id}`);
}

function DeskNavIcon({ id }: { id: PanelTab }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (id === "search") {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16.5 21 21" />
      </svg>
    );
  }
  if (id === "charts") {
    return (
      <svg {...common}>
        <path d="M5 19V10" />
        <path d="M12 19V5" />
        <path d="M19 19v-7" />
      </svg>
    );
  }
  if (id === "favorites") {
    return (
      <svg {...common}>
        <path d="M12 19s-7-4.4-7-9.1A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 2.9C19 14.6 12 19 12 19z" />
      </svg>
    );
  }
  if (id === "playlist") {
    return (
      <svg {...common}>
        <path d="M5 7h14M5 12h10M5 17h8" />
        <circle cx="18" cy="16.5" r="2.2" />
        <path d="M20.2 16.5V9.5l3 1" />
      </svg>
    );
  }
  if (id === "history") {
    return (
      <svg {...common}>
        <path d="M4.5 12a7.5 7.5 0 1 0 2-5.1" />
        <path d="M4.5 5.5v4h4" />
        <path d="M12 8.5V12l2.5 1.6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 6h10v12H5z" />
      <path d="M15 9h4v9h-4" />
      <path d="M8 10h4M8 13h4M8 16h2.5" />
    </svg>
  );
}

function DeskTools() {
  return (
    <div className="desk-tools">
      <LocaleSwitcher />
      <SkinSwitcher />
    </div>
  );
}

function DeskRecent() {
  const search = usePlayer((s) => s.search);
  const searchQuery = usePlayer((s) => s.searchQuery);
  const searching = usePlayer((s) => s.searching);
  const dt = useDeskText();
  const [recents, setRecents] = useState(() => loadRecentSearches());
  useEffect(() => {
    setRecents(loadRecentSearches());
  }, [searchQuery, searching]);

  if (!recents.length) {
    return <p className="desk-recents__empty">{dt("recentsEmpty")}</p>;
  }

  return (
    <div className="desk-recents" data-no-swipe>
      <span className="desk-recents__label">{dt("recents")}</span>
      <div className="desk-recents__chips">
        {recents.map((q) => (
          <button key={q} type="button" className="desk-chip" onClick={() => void search(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function DeskStage() {
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search") {
    return (
      <>
        <DeskRecent />
        <TrackList
          tracks={searchResults}
          mode="search"
          empty={tr("empty.search")}
          coverSize="thumb"
        />
      </>
    );
  }
  if (tab === "charts") return <ChartsPanel coverSize="thumb" />;
  if (tab === "playlist") {
    return (
      <TrackList
        tracks={playlist}
        mode="playlist"
        empty={tr("empty.playlist")}
        coverSize="thumb"
      />
    );
  }
  if (tab === "favorites") {
    return (
      <TrackList
        tracks={favorites}
        mode="favorites"
        empty={tr("empty.favorites")}
        coverSize="thumb"
      />
    );
  }
  if (tab === "history") {
    return (
      <TrackList tracks={history} mode="history" empty={tr("empty.history")} coverSize="thumb" />
    );
  }
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return null;
}

function DeskNow({ compact }: { compact?: boolean }) {
  const curTrack = usePlayer((s) => s.curTrack);
  const quality = usePlayer((s) => s.quality);
  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const locateCurrentInList = usePlayer((s) => s.locateCurrentInList);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const dt = useDeskText();
  const qShow = quality && quality !== "…" ? quality : preferredQuality;
  const qLabel = qualityShortLabel(qShow) || String(qShow || "").toUpperCase();

  return (
    <button
      type="button"
      className={`desk-now now-playing ${compact ? "is-compact" : ""} ${loadingPlay ? "loading" : ""}`}
      onClick={() => locateCurrentInList()}
      title={dt("locate")}
      aria-label={dt("locate")}
    >
      <div className={`desk-now__cover ${curTrack?.cover ? "has" : ""}`}>
        {curTrack?.cover ? (
          <CoverImg
            key={String(curTrack.id)}
            src={curTrack.cover}
            className="desk-now__img"
            size="medium"
            priority
          />
        ) : (
          <span aria-hidden>♪</span>
        )}
      </div>
      <div className="desk-now__text">
        <span className="desk-now__kicker">{dt("nowPlaying")}</span>
        <span className="desk-now__title">{curTrack?.name || tr("nowPlaying.pick")}</span>
        <span className="desk-now__artist">{curTrack?.artist || tr("nowPlaying.pick")}</span>
      </div>
      {qLabel ? <span className="desk-now__q">{qLabel}</span> : null}
    </button>
  );
}

function DeskPlayTrio() {
  const playing = usePlaybackClock((c) => c.playing);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  return (
    <div className="desk-trio" role="group" aria-label={tr("transport.controlsAria")}>
      <button
        type="button"
        className="desk-ctrl desk-prev"
        onClick={() => next(-1)}
        aria-label={tr("transport.prev")}
        title={tr("transport.prev")}
      >
        ⏮
      </button>
      <button
        type="button"
        className="desk-ctrl desk-play"
        onClick={togglePlay}
        aria-label={tr("transport.playPause")}
        title={tr("transport.playPauseTitle")}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        className="desk-ctrl desk-next"
        onClick={() => next(1)}
        aria-label={tr("transport.next")}
        title={tr("transport.next")}
      >
        ⏭
      </button>
    </div>
  );
}

function DeskMiniExtras() {
  const cycleMode = usePlayer((s) => s.cycleMode);
  const modeLabel = usePlayer((s) => s.modeLabel);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const curTrack = usePlayer((s) => s.curTrack);
  const isFavorite = usePlayer((s) => s.isFavorite);
  const libraryReadOnly = usePlayer((s) => s.libraryReadOnly);
  const volume = usePlayer((s) => s.volume);
  const muted = usePlayer((s) => s.muted);
  const setVolume = usePlayer((s) => s.setVolume);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const dt = useDeskText();
  const volPct = Math.round((muted ? 0 : volume) * 100);

  return (
    <div className="desk-extras" role="group" aria-label={dt("extras")} data-no-swipe>
      <button
        type="button"
        className="desk-ctrl desk-ctrl--wide"
        onClick={cycleMode}
        title={tr("transport.modeTitle", { mode: modeLabel() })}
        aria-label={tr("transport.modeAria", { mode: modeLabel() })}
      >
        {modeLabel()}
      </button>
      <QualityPicker />
      <button
        type="button"
        className="desk-ctrl"
        onClick={toggleMute}
        aria-label={muted ? tr("transport.unmute") : tr("transport.mute")}
        title={tr("transport.mute")}
      >
        {muted || volPct === 0 ? "🔇" : volPct < 40 ? "🔈" : "🔊"}
      </button>
      <input
        type="range"
        className="desk-vol"
        min={0}
        max={100}
        step={1}
        value={muted ? 0 : volPct}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label={tr("transport.volume")}
      />
      {curTrack ? (
        <button
          type="button"
          className="desk-ctrl"
          onClick={() => toggleFavorite()}
          aria-label={libraryReadOnly ? tr("transport.favReadonly") : tr("transport.fav")}
          title={libraryReadOnly ? tr("transport.favReadonlyTitle") : tr("transport.favTitle")}
          disabled={libraryReadOnly}
        >
          {isFavorite(curTrack.id) ? "♥" : "♡"}
        </button>
      ) : null}
    </div>
  );
}

export function DeskLayout({ brand }: { brand: string }) {
  const { mobile, compact } = useDeskViewport();
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const skin = usePlayer((s) => s.skin);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const dt = useDeskText();
  const theme = getDeskTheme(skin);
  const vars = useMemo(() => deskThemeVars(theme), [theme]);

  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";

  useEffect(() => {
    const root = document.documentElement;
    const applied = deskThemeVars(theme);
    const prev: Record<string, string> = {};
    for (const [k, v] of Object.entries(applied)) {
      prev[k] = root.style.getPropertyValue(k);
      root.style.setProperty(k, v);
    }
    const applyInset = () => {
      const phone = window.matchMedia("(max-width: 720px)").matches;
      if (phone) {
        root.style.setProperty(
          "--search-overlay-bottom",
          "calc(var(--desk-mini-h, 168px) + var(--desk-foot-h, 56px) + env(safe-area-inset-bottom, 0px))"
        );
      } else {
        root.style.removeProperty("--search-overlay-bottom");
      }
    };
    applyInset();
    const mq = window.matchMedia("(max-width: 720px)");
    mq.addEventListener?.("change", applyInset);
    return () => {
      mq.removeEventListener?.("change", applyInset);
      root.style.removeProperty("--search-overlay-bottom");
      for (const [k, v] of Object.entries(prev)) {
        if (v) root.style.setProperty(k, v);
        else root.style.removeProperty(k);
      }
    };
  }, [theme]);

  const navItems = mobile ? FOOT : NAV;

  return (
    <div
      className="layout-desk"
      data-layout="desk"
      data-theme={theme.id}
      data-tab={tab}
      data-mobile={mobile ? "1" : undefined}
      data-vp={mobile ? "phone" : compact ? "tablet" : "desktop"}
      style={
        {
          ...vars,
          background: "var(--wallpaper)",
          color: "var(--fg)",
          fontFamily: "var(--font)",
        } as CSSProperties
      }
    >
      <aside className="desk-rail">
        <div className="desk-brand" title={brand}>
          <span className="desk-brand__mark">{mark}</span>
          {themeName ? <span className="desk-brand__theme">{themeName}</span> : null}
        </div>
        <p className="desk-rail__kicker">{dt("library")}</p>
        <nav className="desk-nav" aria-label={dt("nav")} data-no-swipe>
          {NAV.map((id) => (
            <button
              key={id}
              type="button"
              className={`desk-nav__btn ${tab === id ? "on" : ""}`}
              onClick={() => setTab(id)}
            >
              <DeskNavIcon id={id} />
              <span className="desk-nav__full">{tabLabel(tr, id, false)}</span>
              <span className="desk-nav__short">{tabLabel(tr, id, true)}</span>
            </button>
          ))}
        </nav>
      </aside>

      <header className="desk-top">
        {mobile ? (
          <>
            <div className="desk-brand desk-brand--top" title={brand}>
              <span className="desk-brand__mark">{mark}</span>
            </div>
            <button
              type="button"
              className="desk-search-launch"
              aria-label={tr("search.aria")}
              title={tr("search.aria")}
              onClick={() => openMobileSearchFromGesture()}
            >
              <DeskNavIcon id="search" />
            </button>
          </>
        ) : (
          <SearchBar className="desk-search" />
        )}
        <DeskTools />
      </header>

      <main className="desk-stage" id="desk-stage">
        <DeskStage />
      </main>

      <footer className="desk-dock player-bar">
        {mobile ? (
          <div className="desk-mini">
            <div className="desk-mini__row">
              <DeskNow compact />
              <DeskPlayTrio />
            </div>
            <Transport compact />
            <DeskMiniExtras />
          </div>
        ) : (
          <>
            <DeskNow />
            <div className="desk-dock__transport">
              <Transport />
            </div>
          </>
        )}
      </footer>

      {mobile ? (
        <nav className="desk-foot" aria-label={dt("foot")} data-no-swipe>
          {navItems.map((id) => (
            <button
              key={id}
              type="button"
              className={`desk-foot__btn ${tab === id ? "on" : ""}`}
              onClick={() => setTab(id)}
            >
              <DeskNavIcon id={id} />
              <span>{tabLabel(tr, id, false)}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
