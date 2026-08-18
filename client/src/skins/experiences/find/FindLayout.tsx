import { useEffect, type CSSProperties } from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { openMobileSearchFromGesture, preloadSearchOverlay } from "../../../lib/search-gesture";
import { SearchBar } from "../../../components/SearchBar";
import { SkinSwitcher } from "../../../components/SkinSwitcher";
import { TrackList } from "../../../components/TrackList";
import { Transport } from "../../../components/Transport";
import { useT } from "../../../i18n";
import type { PanelTab } from "../../../lib/types";
import { usePlayer } from "../../../store/player";
import { findText } from "./i18n";
import { findThemeToCssVars, getFindTheme } from "./theme";
import "./find.css";

const DRAWERS: PanelTab[] = ["favorites", "history", "charts", "playlist", "lyrics"];

function drawerLabel(tr: (k: string) => string, id: PanelTab): string {
  if (id === "favorites") return tr("tabs.favorites");
  if (id === "history") return tr("tabs.history");
  if (id === "charts") return tr("tabs.charts");
  if (id === "playlist") return tr("tabs.playlist");
  return tr("tabs.lyrics");
}

function FindStage() {
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search") {
    return (
      <TrackList
        tracks={searchResults}
        mode="search"
        empty={tr("empty.search")}
        coverSize="thumb"
      />
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
      <TrackList
        tracks={history}
        mode="history"
        empty={tr("empty.history")}
        coverSize="thumb"
      />
    );
  }
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return null;
}

export function FindLayout({ brand }: { brand: string }) {
  const setTab = usePlayer((s) => s.setTab);
  const tab = usePlayer((s) => s.tab);
  const skin = usePlayer((s) => s.skin);
  const locale = usePlayer((s) => s.locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const searching = usePlayer((s) => s.searching);
  const curTrack = usePlayer((s) => s.curTrack);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const tr = useT(locale);
  const theme = getFindTheme(skin);
  const parts = brand.split("·").map((s) => s.trim());
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : brand;

  useEffect(() => {
    setTab("search");
    const id = window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLInputElement>(".layout-find .find-search input")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [setTab]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const phone = window.matchMedia("(max-width: 720px)").matches;
      root.style.setProperty(
        "--search-overlay-bottom",
        phone
          ? "calc(148px + env(safe-area-inset-bottom, 0px))"
          : "calc(112px + env(safe-area-inset-bottom, 0px))"
      );
    };
    apply();
    const mq = window.matchMedia("(max-width: 720px)");
    mq.addEventListener?.("change", apply);
    return () => {
      mq.removeEventListener?.("change", apply);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, []);

  const onSearch = tab === "search";
  const status = onSearch
    ? searching
      ? tr("search.loading")
      : searchResults.length
        ? findText(locale, "queueHint", { n: searchResults.length })
        : findText(locale, "queueEmpty")
    : findText(locale, "backToSearch");

  return (
    <div
      className="layout-find"
      data-find={theme.id}
      data-tab={tab}
      style={findThemeToCssVars(theme) as CSSProperties}
    >
      <header className="find-top">
        <div className="find-brand">
          <span className="find-mark">{findText(locale, "mark")}</span>
          <span className="find-brand-sep" aria-hidden>
            ·
          </span>
          <span className="find-brand-name">{themeName}</span>
        </div>
        <div className="find-tools">
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </header>

      <section className="find-hero" aria-label={tr("search.aria")} data-find-hero>
        <p className="find-kicker">{findText(locale, "kicker")}</p>
        <div className="find-well" data-find-well>
          <SearchBar className="find-search skin-search" />
          <button
            type="button"
            className="find-overlay-btn"
            aria-label={findText(locale, "overlay")}
            title={findText(locale, "overlay")}
            onPointerDown={() => void preloadSearchOverlay()}
            onClick={() => openMobileSearchFromGesture()}
          >
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <circle cx="11" cy="11" r="6.25" />
              <path d="M16 16l4.25 4.25" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className={`find-status ${onSearch ? "" : "find-status--jump"}`}
          onClick={() => setTab("search")}
          disabled={onSearch}
        >
          <span className="find-status-pill">{onSearch ? "QUEUE" : "FIND"}</span>
          <span className="find-status-copy">{status}</span>
        </button>
      </section>

      <nav className="find-drawers" aria-label={findText(locale, "drawersAria")} data-no-swipe>
        <span className="find-drawers-label">{findText(locale, "drawers")}</span>
        {DRAWERS.map((id) => {
          const on = tab === id;
          return (
            <button
              key={id}
              type="button"
              className={`find-chip ${on ? "on" : ""}`}
              data-find-chip={id}
              aria-current={on ? "page" : undefined}
              onClick={() => setTab(id)}
            >
              {drawerLabel(tr, id)}
            </button>
          );
        })}
      </nav>

      <main className="find-stage">{<FindStage />}</main>

      <footer className={`find-mini ${loadingPlay ? "loading" : ""}`}>
        <button
          type="button"
          className={`find-mini-art ${curTrack?.cover ? "has" : ""}`}
          onClick={() => setTab("lyrics")}
          aria-label={findText(locale, "lyricsFromCover")}
          title={findText(locale, "lyricsFromCover")}
        >
          {curTrack?.cover ? (
            <CoverImg
              key={String(curTrack.id)}
              src={curTrack.cover}
              className="find-mini-cover"
              size="thumb"
              priority
            />
          ) : (
            <span aria-hidden>♪</span>
          )}
        </button>
        <div className="find-mini-meta">
          <p className="find-mini-title">{curTrack?.name || tr("nowPlaying.pick")}</p>
          <p className="find-mini-artist">
            {curTrack?.artist || findText(locale, curTrack ? "playing" : "idle")}
          </p>
        </div>
        <div className="find-mini-transport">
          <Transport />
        </div>
      </footer>
    </div>
  );
}
