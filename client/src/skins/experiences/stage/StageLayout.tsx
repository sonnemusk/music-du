import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
import type { PanelTab } from "../../../lib/types";
import { usePlayer } from "../../../store/player";
import { stageText } from "./i18n";
import "./stage.css";
import {
  getStageTheme,
  isStageThemeId,
  stageThemeToCssVars,
  type StageThemeId,
} from "./theme";

const WINGS: PanelTab[] = ["favorites", "history", "search", "charts", "lyrics", "playlist"];

const WING_I18N: Record<PanelTab, { full: string; short: string }> = {
  favorites: { full: "tabs.favorites", short: "tabs.favoritesShort" },
  history: { full: "tabs.history", short: "tabs.historyShort" },
  search: { full: "tabs.search", short: "tabs.searchShort" },
  charts: { full: "tabs.charts", short: "tabs.chartsShort" },
  lyrics: { full: "tabs.lyrics", short: "tabs.lyricsShort" },
  playlist: { full: "tabs.playlist", short: "tabs.playlistShort" },
};

function useNarrowStage() {
  const [narrow, setNarrow] = useState(() => isMobileSearchUi());
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return narrow;
}

function StagePanel({ tab }: { tab: PanelTab }) {
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search") {
    return (
      <TrackList tracks={searchResults} mode="search" empty={tr("empty.search")} coverSize="thumb" />
    );
  }
  if (tab === "charts") return <ChartsPanel coverSize="thumb" />;
  if (tab === "playlist") {
    return (
      <TrackList tracks={playlist} mode="playlist" empty={tr("empty.playlist")} coverSize="thumb" />
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
  return <LyricsView variant="panel" />;
}

export function StageLayout({ brand }: { brand: string }) {
  const narrow = useNarrowStage();
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const curTrack = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const skin = usePlayer((s) => s.skin);
  const setSkin = usePlayer((s) => s.setSkin);

  const themeId: StageThemeId = isStageThemeId(skin) ? skin : "stage-dim";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const hostRef = useRef<HTMLDivElement>(null);
  const floorRef = useRef<HTMLElement>(null);
  const footsRef = useRef<HTMLDivElement>(null);

  const theme = getStageTheme(themeId);
  const vars = useMemo(() => stageThemeToCssVars(theme) as CSSProperties, [theme]);
  const bg = curTrack?.cover ? cover(curTrack.cover, "full") : "";

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSheet();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen, closeSheet]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const host = hostRef.current;
    const floor = floorRef.current;
    const foots = footsRef.current;
    if (!host || !floor || !foots) return;

    const apply = () => {
      const phone = window.matchMedia("(max-width: 720px)").matches;
      if (!phone) {
        host.style.removeProperty("--stage-reserve");
        root.style.removeProperty("--search-overlay-bottom");
        return;
      }
      const reserve = Math.max(120, Math.ceil(floor.getBoundingClientRect().bottom - foots.getBoundingClientRect().top));
      host.style.setProperty("--stage-reserve", `${reserve}px`);
      root.style.setProperty(
        "--search-overlay-bottom",
        `calc(${reserve}px + env(safe-area-inset-bottom, 0px))`,
      );
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(floor);
    ro.observe(foots);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, [narrow, sheetOpen]);

  const openWing = (id: PanelTab) => {
    if (id === "search" && narrow) {
      setSheetOpen(false);
      setLyricsOpen(false);
      openMobileSearchFromGesture();
      return;
    }
    if (id === "lyrics" && narrow) {
      setSheetOpen(false);
      setTab("lyrics");
      setLyricsOpen((open) => (tab === "lyrics" ? !open : true));
      return;
    }
    setLyricsOpen(false);
    if (sheetOpen && tab === id) {
      setSheetOpen(false);
      return;
    }
    setTab(id);
    setSheetOpen(true);
  };

  const pickLighting = (id: StageThemeId) => {
    setSkin(id);
  };

  const cycleLighting = () => {
    pickLighting(themeId === "stage-dim" ? "stage-deep" : "stage-dim");
  };

  const sheetTitle = tr(WING_I18N[tab].full);

  return (
    <div
      ref={hostRef}
      className="layout-stage"
      data-layout="stage"
      data-theme={themeId}
      data-sheet={sheetOpen ? tab : undefined}
      data-face={narrow && lyricsOpen ? "lyrics" : undefined}
      data-narrow={narrow ? "1" : undefined}
      style={{
        ...vars,
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      {bg ? (
        <div className="stage-house" style={{ backgroundImage: `url(${bg})` }} aria-hidden />
      ) : null}
      <div className="stage-veil" aria-hidden />

      <header className="stage-rail">
        <p className="stage-brand" title={brand}>
          <span className="stage-brand__mark">{brand.split("·")[0]?.trim() || "Music"}</span>
          <span className="stage-brand__sep" aria-hidden>
            ·
          </span>
          <span className="stage-brand__name">{locale === "en" ? theme.nameEn : theme.name}</span>
        </p>
        <div className="stage-tools">
          <div className="stage-lights" role="group" aria-label={stageText(locale, "lightingAria")}>
            <button
              type="button"
              className={`stage-light ${themeId === "stage-dim" ? "on" : ""}`}
              aria-pressed={themeId === "stage-dim"}
              onClick={() => pickLighting("stage-dim")}
            >
              {stageText(locale, "themeDim")}
            </button>
            <button
              type="button"
              className={`stage-light ${themeId === "stage-deep" ? "on" : ""}`}
              aria-pressed={themeId === "stage-deep"}
              onClick={() => pickLighting("stage-deep")}
            >
              {stageText(locale, "themeDeep")}
            </button>
            <button
              type="button"
              className="stage-light stage-light--cycle"
              aria-label={stageText(locale, "themeToggle")}
              title={stageText(locale, "themeToggle")}
              onClick={cycleLighting}
            >
              ⌂
            </button>
          </div>
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </header>

      <main ref={floorRef} className="stage-floor">
        <div className={`now-playing stage-now ${loadingPlay ? "loading" : ""}`}>
          <div className="stage-proscenium">
            <div
              className={`stage-art ${curTrack?.cover ? "has" : ""}`}
              onClick={() => {
                if (!narrow) return;
                setTab("lyrics");
                setSheetOpen(false);
                setLyricsOpen(true);
              }}
            >
              {curTrack?.cover ? (
                <CoverImg
                  key={String(curTrack.id)}
                  src={curTrack.cover}
                  className="stage-art__img"
                  size="medium"
                  priority
                />
              ) : (
                <span className="stage-art__rest" aria-hidden>
                  ♪
                </span>
              )}
            </div>
          </div>
          <div className="stage-verse" data-no-swipe>
            <LyricsView variant="panel" />
          </div>
          <h1 className="stage-title" title={curTrack?.name || undefined}>
            {curTrack?.name || tr("nowPlaying.pick")}
          </h1>
          <p className="stage-artist" title={curTrack?.artist || undefined}>
            {curTrack?.artist || tr("nowPlaying.pick")}
          </p>
        </div>

        <div ref={footsRef} className="stage-foots">
          <Transport />
        </div>

        <nav className="stage-wings" aria-label={stageText(locale, "wingsAria")} data-no-swipe>
          {WINGS.map((id) => {
            const on = id === "lyrics" && narrow ? lyricsOpen : sheetOpen && tab === id;
            const full = tr(WING_I18N[id].full);
            // 6-up rail truncates EN "History"/"Charts"; zh full is already 2 chars.
            const label = locale === "en" ? tr(WING_I18N[id].short) : full;
            return (
              <button
                key={id}
                type="button"
                className={`stage-cue ${on ? "on" : ""}`}
                data-cue={id}
                data-stage-search={id === "search" ? "1" : undefined}
                aria-label={full}
                aria-expanded={id === "search" && narrow ? undefined : on}
                aria-controls={
                  (id === "search" || id === "lyrics") && narrow ? undefined : "stage-sheet"
                }
                onPointerDown={() => {
                  if (id === "search" && narrow) void preloadSearchOverlay();
                }}
                onClick={() => openWing(id)}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </main>

      {sheetOpen ? (
        <div className="stage-curtain">
          <button
            type="button"
            className="stage-curtain__hit"
            aria-label={stageText(locale, "curtainAria")}
            onClick={closeSheet}
          />
          <aside
            id="stage-sheet"
            className="stage-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={sheetTitle}
            data-no-swipe
          >
            <div className="stage-sheet__handle" aria-hidden>
              <span />
            </div>
            <header className="stage-sheet__head">
              <h2 className="stage-sheet__title">{sheetTitle}</h2>
              <button
                type="button"
                className="stage-sheet__close"
                aria-label={stageText(locale, "sheetClose")}
                onClick={closeSheet}
              >
                ×
              </button>
            </header>
            {tab === "search" && !narrow ? <SearchBar className="stage-search" /> : null}
            <div className="stage-sheet__body">
              <StagePanel tab={tab} />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
