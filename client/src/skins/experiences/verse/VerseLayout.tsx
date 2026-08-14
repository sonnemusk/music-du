import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
import { usePlaybackClock } from "../../../store/playback-clock";
import { usePlayer } from "../../../store/player";
import { verseT } from "./i18n";
import { getVerseTheme, verseThemeToCssVars } from "./theme";
import "./verse.css";

function useNarrow() {
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

const LEAVES: PanelTab[] = ["lyrics", "search", "charts", "playlist", "favorites", "history"];

function leafLabel(tab: PanelTab, locale: "zh" | "en"): string {
  if (tab === "search") return verseT(locale, "leafSearch");
  if (tab === "charts") return verseT(locale, "leafCharts");
  if (tab === "playlist") return verseT(locale, "leafPlaylist");
  if (tab === "favorites") return verseT(locale, "leafFavorites");
  if (tab === "history") return verseT(locale, "leafHistory");
  return verseT(locale, "leafLyrics");
}

function leafGlyph(tab: PanelTab, locale: "zh" | "en"): string {
  if (tab === "search") return verseT(locale, "glyphSearch");
  if (tab === "charts") return verseT(locale, "glyphCharts");
  if (tab === "playlist") return verseT(locale, "glyphPlaylist");
  if (tab === "favorites") return verseT(locale, "glyphFavorites");
  if (tab === "history") return verseT(locale, "glyphHistory");
  return verseT(locale, "glyphLyrics");
}

function VerseLeafBody() {
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
        <SearchBar className="verse-search" />
        <TrackList tracks={searchResults} mode="search" empty={tr("empty.search")} />
      </>
    );
  }
  if (tab === "charts") return <ChartsPanel />;
  if (tab === "playlist") {
    return <TrackList tracks={playlist} mode="playlist" empty={tr("empty.playlist")} />;
  }
  if (tab === "favorites") {
    return <TrackList tracks={favorites} mode="favorites" empty={tr("empty.favorites")} />;
  }
  if (tab === "history") {
    return <TrackList tracks={history} mode="history" empty={tr("empty.history")} />;
  }
  return null;
}

export function VerseLayout({ brand }: { brand: string }) {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const skin = usePlayer((s) => s.skin);
  const locale = usePlayer((s) => s.locale);
  const curTrack = usePlayer((s) => s.curTrack);
  const next = usePlayer((s) => s.next);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const tr = useT(locale);
  const playing = usePlaybackClock((c) => c.playing);
  const narrow = useNarrow();
  const verseTheme = getVerseTheme(skin);
  const leafOpen = tab !== "lyrics";
  const dockRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const current = usePlayer.getState().tab;
    if (current !== "lyrics") usePlayer.getState().setTab("lyrics");
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const dock = dockRef.current;
    const apply = () => {
      const h = dock?.getBoundingClientRect().height ?? 0;
      const px = Math.ceil(Math.max(h, 96));
      root.style.setProperty("--search-overlay-bottom", `${px}px`);
    };
    apply();
    const ro =
      dock && typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (dock && ro) ro.observe(dock);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, []);

  const onKey = (id: PanelTab) => {
    if (id === "search" && narrow) {
      openMobileSearchFromGesture();
      return;
    }
    setTab(id);
  };

  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";

  const vars = verseTheme ? (verseThemeToCssVars(verseTheme) as CSSProperties) : undefined;

  return (
    <div
      className="verse"
      data-layout="verse"
      data-verse={verseTheme?.id ?? "inherit"}
      data-leaf={leafOpen ? tab : undefined}
      style={vars}
    >
      <header className="verse-mast">
        <div className="verse-brand" title={brand}>
          <span className="verse-brand__mark">{mark}</span>
          {themeName ? <span className="verse-brand__theme">{themeName}</span> : null}
        </div>
        <div className="verse-tools">
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </header>

      <div className="verse-body">
        <section className="verse-stage" aria-label={tr("lyrics.aria")}>
          <div className="verse-lyrics">
            <LyricsView variant="panel" />
          </div>
        </section>

        <nav className="verse-keys" aria-label={verseT(locale, "keysAria")} data-no-swipe>
          {LEAVES.map((id) => {
            const on = id === "search" && narrow ? false : tab === id;
            const label = leafLabel(id, locale);
            return (
              <button
                key={id}
                type="button"
                data-key={id}
                className={`verse-key${id === "search" ? " verse-key--search" : ""}${on ? " on" : ""}`}
                aria-current={on ? "page" : undefined}
                aria-label={id === "search" && narrow ? verseT(locale, "searchLaunch") : label}
                title={label}
                onClick={() => onKey(id)}
              >
                <span className="verse-key__glyph" aria-hidden>
                  {leafGlyph(id, locale)}
                </span>
                <span className="verse-key__label">{label}</span>
              </button>
            );
          })}
        </nav>

        {leafOpen ? (
          <aside className="verse-leaf" aria-label={verseT(locale, "sheetAria")} data-no-swipe>
            <div className="verse-leaf__head">
              <h2 className="verse-leaf__title">{leafLabel(tab, locale)}</h2>
              <button
                type="button"
                className="verse-close"
                onClick={() => setTab("lyrics")}
                aria-label={verseT(locale, "closeSheet")}
                title={verseT(locale, "closeSheet")}
              >
                ×
              </button>
            </div>
            <div className="verse-leaf__body">
              <VerseLeafBody />
            </div>
          </aside>
        ) : null}
      </div>

      <footer
        ref={dockRef}
        className="verse-dock player-bar"
        aria-label={verseT(locale, "dockAria")}
      >
        <button
          type="button"
          className={`verse-dock__art${curTrack?.cover ? " has" : ""}`}
          onClick={() => setTab("lyrics")}
          aria-label={verseT(locale, "leafLyrics")}
        >
          {curTrack?.cover ? (
            <CoverImg
              key={String(curTrack.id)}
              src={curTrack.cover}
              className="verse-dock__cover"
              size="medium"
              priority
            />
          ) : (
            <span aria-hidden>♪</span>
          )}
        </button>
        <div className="verse-dock__meta">
          <p className="verse-dock__title">{curTrack?.name || tr("nowPlaying.pick")}</p>
          <p className="verse-dock__artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
        </div>
        <div className="verse-ctrls" role="group" aria-label={verseT(locale, "controlsAria")}>
          <button
            type="button"
            className="verse-ctrl"
            onClick={() => next(-1)}
            aria-label={tr("transport.prev")}
            title={tr("transport.prev")}
          >
            ⏮
          </button>
          <button
            type="button"
            className="verse-ctrl verse-ctrl--play"
            onClick={togglePlay}
            aria-label={tr("transport.playPause")}
            title={tr("transport.playPauseTitle")}
          >
            {playing ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            className="verse-ctrl"
            onClick={() => next(1)}
            aria-label={tr("transport.next")}
            title={tr("transport.next")}
          >
            ⏭
          </button>
        </div>
        <div className="verse-dock__seek">
          <Transport compact />
        </div>
      </footer>
    </div>
  );
}
