import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from "react";
import { ChartsPanel } from "../../../components/ChartsPanel";
import { CoverImg } from "../../../components/CoverImg";
import { LocaleSwitcher } from "../../../components/LocaleSwitcher";
import { LyricsView } from "../../../components/LyricsView";
import { SearchBar } from "../../../components/SearchBar";
import { SkinSwitcher } from "../../../components/SkinSwitcher";
import { TrackList } from "../../../components/TrackList";
import { Transport } from "../../../components/Transport";
import { useT } from "../../../i18n";
import { isMobileSearchUi } from "../../../lib/mobile-ui";
import { openMobileSearchFromGesture, preloadSearchOverlay } from "../../../lib/search-gesture";
import type { PanelTab } from "../../../lib/types";
import { useLyricIdx } from "../../../store/lyric-clock";
import { usePlaybackClock } from "../../../store/playback-clock";
import { usePlayer } from "../../../store/player";
import { pocketT } from "./i18n";
import {
  DEFAULT_POCKET_THEME,
  getPocketTheme,
  isPocketThemeId,
  pocketThemeToCssVars,
  type PocketThemeId,
} from "./theme";
import "./pocket.css";

type PocketPage = "now" | "library";
type PocketFace = "cover" | "lyrics";
type PocketTab = "now" | "playlist" | "favorites" | "charts" | "history";

const TABS: PocketTab[] = ["now", "playlist", "favorites", "charts", "history"];

type IconProps = { className?: string };

const ICONS: Record<PocketTab, (p: IconProps) => JSX.Element> = {
  now: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M10 9.5v5l5-2.5-5-2.5z" />
    </svg>
  ),
  playlist: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 7h12M5 12h12M5 17h7" />
      <circle cx="18" cy="16.5" r="2.2" />
      <path d="M20.2 16.5V9l-2.6.9" />
    </svg>
  ),
  favorites: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden>
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z" />
    </svg>
  ),
  charts: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden>
      <path d="M5 19v-6M10 19V7M15 19v-9M20 19V5" />
    </svg>
  ),
  history: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.2L15 14" />
    </svg>
  ),
};

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

function PocketBody({ tab }: { tab: PanelTab }) {
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search") {
    return (
      <>
        <SearchBar className="pocket-search" />
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

function PocketMini({ onOpen }: { onOpen: () => void }) {
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const curTrack = usePlayer((s) => s.curTrack);
  const next = usePlayer((s) => s.next);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playing = usePlaybackClock((c) => c.playing);

  return (
    <div className="pocket-mini player-bar" aria-label={pocketT(locale, "miniAria")}>
      <button
        type="button"
        className="pocket-mini__art"
        onClick={onOpen}
        aria-label={pocketT(locale, "openNow")}
      >
        {curTrack?.cover ? (
          <CoverImg key={String(curTrack.id)} src={curTrack.cover} size="thumb" priority />
        ) : (
          <span aria-hidden>♪</span>
        )}
      </button>
      <button type="button" className="pocket-mini__meta" onClick={onOpen}>
        <span className="pocket-mini__title">{curTrack?.name || tr("nowPlaying.pick")}</span>
        <span className="pocket-mini__artist">{curTrack?.artist || tr("nowPlaying.pick")}</span>
      </button>
      <div className="pocket-mini__ctrls" role="group" aria-label={tr("transport.controlsAria")}>
        <button
          type="button"
          className="pocket-mini__btn"
          data-pocket-ctrl="prev"
          onClick={() => next(-1)}
          aria-label={tr("transport.prev")}
        >
          ⏮
        </button>
        <button
          type="button"
          className="pocket-mini__btn play"
          data-pocket-ctrl="play"
          onClick={togglePlay}
          aria-label={tr("transport.playPause")}
        >
          {playing ? "⏸" : "▶"}
        </button>
        <button
          type="button"
          className="pocket-mini__btn"
          data-pocket-ctrl="next"
          onClick={() => next(1)}
          aria-label={tr("transport.next")}
        >
          ⏭
        </button>
      </div>
    </div>
  );
}

export function PocketLayout({ brand }: { brand: string }) {
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const skin = usePlayer((s) => s.skin);
  const setSkin = usePlayer((s) => s.setSkin);
  const curTrack = usePlayer((s) => s.curTrack);
  const coverUrl = usePlayer((s) => s.cover);
  const lyrics = usePlayer((s) => s.lyrics);
  const lyricIdx = useLyricIdx();
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const isDemoSite = usePlayer((s) => s.isDemoSite);
  const narrow = useNarrow();

  const palette: PocketThemeId = isPocketThemeId(skin) ? skin : DEFAULT_POCKET_THEME;
  const theme = getPocketTheme(palette);
  const vars = useMemo(() => pocketThemeToCssVars(theme) as CSSProperties, [theme]);

  const [page, setPage] = useState<PocketPage>("now");
  const [face, setFace] = useState<PocketFace>(() =>
    usePlayer.getState().tab === "lyrics" ? "lyrics" : "cover"
  );

  const dockRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const tabs = tabsRef.current?.getBoundingClientRect().height ?? 0;
      const mini = page === "library" ? dockRef.current?.getBoundingClientRect().height ?? 0 : 0;
      const px = Math.ceil(Math.max(tabs + mini, 96));
      root.style.setProperty("--search-overlay-bottom", `${px}px`);
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    if (tabsRef.current && ro) ro.observe(tabsRef.current);
    if (dockRef.current && ro) ro.observe(dockRef.current);
    window.addEventListener("resize", apply);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, [page]);

  const goTab = (id: PocketTab) => {
    if (id === "now") {
      setPage("now");
      return;
    }
    setTab(id);
    setPage("library");
  };

  const line = lyricIdx >= 0 ? lyrics[lyricIdx] : undefined;
  const bleed =
    palette === "pocket-ink" && page === "now" && curTrack?.cover
      ? coverUrl(curTrack.cover, "full")
      : "";

  const libraryTab: PanelTab =
    tab === "lyrics" || tab === "search" ? "playlist" : tab;
  const libraryTitle = pocketT(locale, `tab.${libraryTab}`);

  return (
    <div
      className="pocket"
      data-layout="pocket"
      data-pocket={palette}
      data-page={page}
      data-face={face}
      style={{
        ...vars,
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      {bleed ? (
        <div className="pocket-bleed" style={{ backgroundImage: `url(${bleed})` }} aria-hidden />
      ) : null}
      <div className="pocket-veil" aria-hidden />

      <header className="pocket-mast">
        <div className="pocket-brand" title={brand}>
          <span className="pocket-brand__mark">{pocketT(locale, "mark")}</span>
          <span className="pocket-brand__name">
            {locale === "en" ? theme.nameEn : theme.name}
          </span>
        </div>
        {narrow ? (
          <button
            type="button"
            className="pocket-search-launch"
            aria-label={pocketT(locale, "searchLaunch")}
            onPointerDown={() => void preloadSearchOverlay()}
            onClick={() => openMobileSearchFromGesture()}
          >
            ⌕
          </button>
        ) : (
          <SearchBar className="pocket-search" />
        )}
        <div className="pocket-tools">
          <div className="pocket-palettes" role="group" aria-label={pocketT(locale, "paletteAria")}>
            <button
              type="button"
              className={`pocket-palette ${palette === "pocket-paper" ? "on" : ""}`}
              aria-pressed={palette === "pocket-paper"}
              title={pocketT(locale, "paperTitle")}
              onClick={() => setSkin("pocket-paper")}
            >
              {pocketT(locale, "paper")}
            </button>
            <button
              type="button"
              className={`pocket-palette ${palette === "pocket-ink" ? "on" : ""}`}
              aria-pressed={palette === "pocket-ink"}
              title={pocketT(locale, "inkTitle")}
              onClick={() => setSkin("pocket-ink")}
            >
              {pocketT(locale, "ink")}
            </button>
          </div>
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </header>

      <div className="pocket-body">
        {page === "now" ? (
          <section
            className={`pocket-now${loadingPlay ? " loading" : ""}`}
            aria-label={pocketT(locale, "nowAria")}
          >
            <div className="pocket-stage">
              <div className="pocket-cover-slot">
                <button
                  type="button"
                  className={`pocket-cover${curTrack?.cover ? " has" : ""}`}
                  onClick={() => setFace((f) => (f === "cover" ? "lyrics" : "cover"))}
                  aria-label={
                    face === "cover" ? pocketT(locale, "faceLyrics") : pocketT(locale, "backCover")
                  }
                >
                  {curTrack?.cover ? (
                    <CoverImg
                      key={String(curTrack.id)}
                      src={curTrack.cover}
                      className="pocket-cover__img"
                      size="medium"
                      priority
                    />
                  ) : (
                    <span className="pocket-cover__rest" aria-hidden>
                      ♪
                    </span>
                  )}
                </button>
              </div>
              <div className="pocket-verse">
                <LyricsView variant="panel" />
              </div>
            </div>

            <div className="pocket-meta">
              <h1 className="pocket-title">{curTrack?.name || tr("nowPlaying.pick")}</h1>
              <p className="pocket-artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
              <div className="pocket-faces" role="tablist" aria-label={pocketT(locale, "facesAria")}>
                <button
                  type="button"
                  role="tab"
                  className={`pocket-face ${face === "cover" ? "on" : ""}`}
                  aria-selected={face === "cover"}
                  onClick={() => setFace("cover")}
                >
                  {pocketT(locale, "faceCover")}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`pocket-face ${face === "lyrics" ? "on" : ""}`}
                  aria-selected={face === "lyrics"}
                  onClick={() => setFace("lyrics")}
                >
                  {pocketT(locale, "faceLyrics")}
                </button>
              </div>
              {palette === "pocket-ink" && face === "cover" ? (
                <button
                  type="button"
                  className="pocket-line"
                  onClick={() => setFace("lyrics")}
                  aria-label={pocketT(locale, "lineHint")}
                >
                  {line?.orig || pocketT(locale, "flipHint")}
                </button>
              ) : (
                <p className="pocket-hint">{pocketT(locale, "flipHint")}</p>
              )}
            </div>

            <div className="pocket-transport" data-no-swipe>
              <Transport />
            </div>
          </section>
        ) : (
          <section className="pocket-library" aria-label={pocketT(locale, "libraryAria")}>
            {isDemoSite ? <p className="pocket-demo">{tr("demo.banner")}</p> : null}
            <header className="pocket-library__head">
              <h1 className="pocket-library__title">{libraryTitle}</h1>
            </header>
            <div className="pocket-library__body">
              <PocketBody tab={libraryTab} />
            </div>
          </section>
        )}
      </div>

      {page === "library" ? (
        <footer ref={dockRef} className="pocket-tray">
          <PocketMini onOpen={() => setPage("now")} />
        </footer>
      ) : null}

      <nav ref={tabsRef} className="pocket-tabs" aria-label={pocketT(locale, "tabsAria")} data-no-swipe>
        {TABS.map((id) => {
          const Icon = ICONS[id];
          const on = id === "now" ? page === "now" : page === "library" && libraryTab === id;
          return (
            <button
              key={id}
              type="button"
              className={`pocket-tab${on ? " on" : ""}`}
              data-tab={id}
              aria-current={on ? "page" : undefined}
              aria-label={pocketT(locale, `tab.${id}`)}
              onClick={() => goTab(id)}
            >
              <span className="pocket-tab__icon">
                <Icon />
              </span>
              <span className="pocket-tab__label">{pocketT(locale, `tab.${id}`)}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
