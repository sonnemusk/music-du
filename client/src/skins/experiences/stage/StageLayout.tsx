import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { SearchBar } from "../../../components/SearchBar";
import { openMobileSearchFromGesture } from "../../../components/SearchOverlay";
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
  STAGE_THEME_KEY,
  getStageTheme,
  isStageThemeId,
  stageThemeToCssVars,
  type StageThemeId,
} from "./theme";

const WINGS: PanelTab[] = ["favorites", "history", "search", "charts", "lyrics", "playlist"];

function readStageTheme(): StageThemeId {
  try {
    const raw = localStorage.getItem(STAGE_THEME_KEY);
    if (isStageThemeId(raw)) return raw;
  } catch {
    /* */
  }
  return "stage-dim";
}

function persistStageTheme(id: StageThemeId) {
  try {
    localStorage.setItem(STAGE_THEME_KEY, id);
  } catch {
    /* */
  }
}

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

  const [themeId, setThemeId] = useState<StageThemeId>(readStageTheme);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const openWing = (id: PanelTab) => {
    if (id === "search" && narrow) {
      openMobileSearchFromGesture();
      return;
    }
    if (sheetOpen && tab === id) {
      setSheetOpen(false);
      return;
    }
    setTab(id);
    setSheetOpen(true);
  };

  const cycleLighting = () => {
    const next: StageThemeId = themeId === "stage-dim" ? "stage-deep" : "stage-dim";
    setThemeId(next);
    persistStageTheme(next);
  };

  const sheetTitle =
    tab === "search"
      ? tr("tabs.search")
      : tab === "charts"
        ? tr("tabs.charts")
        : tab === "playlist"
          ? tr("tabs.playlist")
          : tab === "favorites"
            ? tr("tabs.favorites")
            : tab === "history"
              ? tr("tabs.history")
              : tr("tabs.lyrics");

  return (
    <div
      className="layout-stage"
      data-layout="stage"
      data-theme={themeId}
      data-sheet={sheetOpen ? tab : undefined}
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
              onClick={() => {
                setThemeId("stage-dim");
                persistStageTheme("stage-dim");
              }}
            >
              {stageText(locale, "themeDim")}
            </button>
            <button
              type="button"
              className={`stage-light ${themeId === "stage-deep" ? "on" : ""}`}
              aria-pressed={themeId === "stage-deep"}
              onClick={() => {
                setThemeId("stage-deep");
                persistStageTheme("stage-deep");
              }}
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

      <main className="stage-floor">
        <div className={`now-playing stage-now ${loadingPlay ? "loading" : ""}`}>
          <div className="stage-proscenium">
            <div className={`stage-art ${curTrack?.cover ? "has" : ""}`}>
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
          <h1 className="stage-title">{curTrack?.name || tr("nowPlaying.pick")}</h1>
          <p className="stage-artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
        </div>

        <div className="stage-foots">
          <Transport />
        </div>

        <nav className="stage-wings" aria-label={stageText(locale, "wingsAria")} data-no-swipe>
          {WINGS.map((id) => {
            const on = sheetOpen && tab === id;
            const label =
              id === "search"
                ? tr("tabs.search")
                : id === "charts"
                  ? tr("tabs.charts")
                  : id === "playlist"
                    ? tr("tabs.playlist")
                    : id === "favorites"
                      ? tr("tabs.favorites")
                      : id === "history"
                        ? tr("tabs.history")
                        : tr("tabs.lyrics");
            return (
              <button
                key={id}
                type="button"
                className={`stage-cue ${on ? "on" : ""}`}
                aria-expanded={on}
                aria-controls={id === "search" && narrow ? undefined : "stage-sheet"}
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
