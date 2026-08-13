import { useEffect, useState } from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { openMobileSearchFromGesture } from "../../../components/SearchOverlay";
import { SearchBar } from "../../../components/SearchBar";
import { SkinSwitcher } from "../../../components/SkinSwitcher";
import { TrackList } from "../../../components/TrackList";
import { Transport } from "../../../components/Transport";
import { useT } from "../../../i18n";
import { isMobileSearchUi } from "../../../lib/mobile-ui";
import type { PanelTab } from "../../../lib/types";
import { usePlayer } from "../../../store/player";
import { useBoardsT } from "./i18n";
import { isBoardsThemeId } from "./theme";
import "./boards.css";

const DEST_TABS: PanelTab[] = ["charts", "favorites", "history", "playlist", "lyrics"];

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

function BoardsStage() {
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

function DestIcon({ id }: { id: PanelTab }) {
  if (id === "charts") {
    return (
      <svg className="boards-ico" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M5 19V11M10 19V6M15 19v-8M20 19V4" />
      </svg>
    );
  }
  if (id === "favorites") {
    return (
      <svg className="boards-ico" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M12 20s-7-4.3-7-9.1A3.8 3.8 0 0 1 12 8.2a3.8 3.8 0 0 1 7 2.7C19 15.7 12 20 12 20z" />
      </svg>
    );
  }
  if (id === "history") {
    return (
      <svg className="boards-ico" viewBox="0 0 24 24" aria-hidden focusable="false">
        <circle cx="12" cy="12" r="7.25" />
        <path d="M12 8.2V12l2.6 1.7" />
      </svg>
    );
  }
  if (id === "playlist") {
    return (
      <svg className="boards-ico" viewBox="0 0 24 24" aria-hidden focusable="false">
        <path d="M5 7.5h14M5 12h10M5 16.5h7" />
      </svg>
    );
  }
  return (
    <svg className="boards-ico" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M6 6.5h12M6 10.5h9M6 14.5h11M6 18.5h6" />
    </svg>
  );
}

function BoardsDest() {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const bt = useBoardsT(locale);

  return (
    <nav className="boards-dest" aria-label={bt("destAria")} data-no-swipe>
      {DEST_TABS.map((id) => {
        const on = tab === id;
        return (
          <button
            key={id}
            type="button"
            className={`boards-dest__plate ${on ? "on" : ""}`}
            aria-current={on ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <DestIcon id={id} />
            <span className="boards-dest__label">{tr(`tabs.${id}`)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function BoardsMini() {
  const curTrack = usePlayer((s) => s.curTrack);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const bt = useBoardsT(locale);

  return (
    <footer className={`boards-mini player-bar ${loadingPlay ? "loading" : ""}`}>
      <button
        type="button"
        className={`boards-mini__art ${curTrack?.cover ? "has" : ""}`}
        onClick={() => setTab("lyrics")}
        aria-label={bt("openLyrics")}
        title={bt("openLyrics")}
      >
        {curTrack?.cover ? (
          <CoverImg
            key={String(curTrack.id)}
            src={curTrack.cover}
            className="boards-mini__cover"
            size="medium"
            priority
          />
        ) : (
          <span aria-hidden>♪</span>
        )}
      </button>
      <div className="boards-mini__meta">
        <p className="boards-mini__kicker">{bt("ticker")}</p>
        <h2 className="boards-mini__title">{curTrack?.name || bt("nowEmpty")}</h2>
        <p className="boards-mini__artist">{curTrack?.artist || ""}</p>
      </div>
      <div className="boards-mini__transport">
        <Transport />
      </div>
    </footer>
  );
}

export function BoardsLayout({ brand }: { brand: string }) {
  const setTab = usePlayer((s) => s.setTab);
  const tab = usePlayer((s) => s.tab);
  const skin = usePlayer((s) => s.skin);
  const chartMetaName = usePlayer((s) => s.chartMetaName);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const bt = useBoardsT(locale);
  const narrow = useNarrow();

  useEffect(() => {
    setTab("charts");
  }, [setTab]);

  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";
  const palette = isBoardsThemeId(skin) ? (skin === "boards-deep" ? "deep" : "dim") : "dim";
  const status =
    tab === "charts" ? chartMetaName || bt("kicker") : tr(`tabs.${tab}`);

  return (
    <div
      className="layout layout-boards"
      data-palette={palette}
      data-tab={tab}
      data-narrow={narrow ? "1" : undefined}
    >
      <header className="boards-mast">
        <div className="boards-brand" title={brand}>
          <span className="boards-brand__glyph" aria-hidden>
            #
          </span>
          <div className="boards-brand__text">
            <p className="boards-brand__kicker">{bt("kicker")}</p>
            <h1 className="boards-brand__word">{bt("wordmark")}</h1>
            <p className="boards-brand__sub">
              <span className="boards-brand__mark">{mark}</span>
              {themeName ? (
                <>
                  <span className="boards-brand__sep" aria-hidden>
                    ·
                  </span>
                  <span className="boards-brand__theme">{themeName}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
        <p className="boards-mast__status">{status}</p>
        <div className="boards-mast__end">
          {narrow ? (
            <button
              type="button"
              className="boards-search-launch"
              aria-label={bt("searchLaunch")}
              title={bt("searchLaunch")}
              onClick={() => openMobileSearchFromGesture()}
            >
              <span aria-hidden>🔍</span>
            </button>
          ) : (
            <SearchBar className="boards-search" />
          )}
          <div className="boards-mast__tools">
            <LocaleSwitcher />
            <SkinSwitcher />
          </div>
        </div>
      </header>
      <BoardsDest />
      <main className="boards-stage">
        <BoardsStage />
      </main>
      <BoardsMini />
    </div>
  );
}
