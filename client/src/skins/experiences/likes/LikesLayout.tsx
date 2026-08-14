import { useEffect, useMemo, useState, type CSSProperties, type JSX } from "react";
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
import { likesT } from "./i18n";
import {
  DEFAULT_LIKES_THEME,
  getLikesTheme,
  isLikesThemeId,
  likesThemeToCssVars,
  type LikesThemeId,
} from "./theme";
import "./likes.css";

const DEST: PanelTab[] = ["favorites", "search", "history", "charts", "lyrics", "playlist"];

type IconProps = { className?: string };

const ICONS: Record<PanelTab, (p: IconProps) => JSX.Element> = {
  favorites: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z" />
    </svg>
  ),
  search: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  ),
  history: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  charts: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M5 19v-6M10 19V7M15 19v-9M20 19V5" />
    </svg>
  ),
  lyrics: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M5 6h14M5 11h10M5 16h12M5 21h7" />
    </svg>
  ),
  playlist: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 7h12M4 12h12M4 17h7" />
      <circle cx="18" cy="16.5" r="2.5" />
      <path d="M20.5 16.5V8l-3 1" />
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

function useTabCount(tab: PanelTab): number | null {
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);
  if (tab === "search") return searchResults.length;
  if (tab === "playlist") return playlist.length;
  if (tab === "favorites") return favorites.length;
  if (tab === "history") return history.length;
  return null;
}

function LikesBody() {
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search") {
    return <TrackList tracks={searchResults} mode="search" empty={tr("empty.search")} />;
  }
  if (tab === "charts") return <ChartsPanel />;
  if (tab === "playlist") {
    return <TrackList tracks={playlist} mode="playlist" empty={tr("empty.playlist")} />;
  }
  if (tab === "history") {
    return <TrackList tracks={history} mode="history" empty={tr("empty.history")} />;
  }
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return <TrackList tracks={favorites} mode="favorites" empty={tr("empty.favorites")} />;
}

function LikesDest({
  variant,
  hideSearch,
}: {
  variant: "spine" | "bar";
  hideSearch?: boolean;
}) {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const ids = hideSearch ? DEST.filter((id) => id !== "search") : DEST;

  return (
    <nav
      className={`likes-dest ${variant === "bar" ? "likes-dest--bar" : ""}`}
      aria-label={likesT(locale, "navAria")}
      data-no-swipe
    >
      {ids.map((id) => {
        const Icon = ICONS[id];
        const on = tab === id;
        return (
          <button
            key={id}
            type="button"
            className={`likes-dest__item ${on ? "on" : ""}`}
            data-dest={id}
            aria-current={on ? "page" : undefined}
            aria-label={likesT(locale, `dest.${id}`)}
            title={likesT(locale, `dest.${id}`)}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span className="likes-dest__label">{likesT(locale, `dest.${id}`)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function LikesPalettes({
  palette,
  onPick,
}: {
  palette: LikesThemeId;
  onPick: (id: LikesThemeId) => void;
}) {
  const locale = usePlayer((s) => s.locale);
  return (
    <div className="likes-palettes" role="group" aria-label={likesT(locale, "palette.aria")}>
      <button
        type="button"
        className={`likes-palettes__btn ${palette === "likes-dim" ? "on" : ""}`}
        aria-pressed={palette === "likes-dim"}
        title={likesT(locale, "palette.dimTitle")}
        onClick={() => onPick("likes-dim")}
      >
        {likesT(locale, "palette.dim")}
      </button>
      <button
        type="button"
        className={`likes-palettes__btn ${palette === "likes-deep" ? "on" : ""}`}
        aria-pressed={palette === "likes-deep"}
        title={likesT(locale, "palette.deepTitle")}
        onClick={() => onPick("likes-deep")}
      >
        {likesT(locale, "palette.deep")}
      </button>
    </div>
  );
}

function LikesMini({ onOpen }: { onOpen: () => void }) {
  const locale = usePlayer((s) => s.locale);
  const curTrack = usePlayer((s) => s.curTrack);
  const next = usePlayer((s) => s.next);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const playing = usePlaybackClock((c) => c.playing);
  const tr = useT(locale);

  return (
    <div className="likes-mini" data-likes-mini aria-label={likesT(locale, "miniAria")}>
      <button
        type="button"
        className="likes-mini__art"
        onClick={onOpen}
        aria-label={likesT(locale, "openTransport")}
      >
        {curTrack?.cover ? (
          <CoverImg key={String(curTrack.id)} src={curTrack.cover} size="thumb" priority />
        ) : (
          <span aria-hidden>♪</span>
        )}
      </button>
      <button type="button" className="likes-mini__meta" onClick={onOpen}>
        <span className="likes-mini__title">{curTrack?.name || tr("nowPlaying.pick")}</span>
        <span className="likes-mini__artist">{curTrack?.artist || tr("nowPlaying.pick")}</span>
      </button>
      <div className="likes-mini__ctrls" role="group" aria-label={tr("transport.controlsAria")}>
        <button
          type="button"
          className="likes-mini__btn"
          data-likes-ctrl="prev"
          onClick={() => next(-1)}
          aria-label={tr("transport.prev")}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6v12h2V6H6zm3.5 6L18 18V6l-8.5 6z" />
          </svg>
        </button>
        <button
          type="button"
          className="likes-mini__btn play"
          data-likes-ctrl="play"
          onClick={togglePlay}
          aria-label={tr("transport.playPause")}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M7 6h3.5v12H7V6zm6.5 0H17v12h-3.5V6z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5.5v13l11-6.5L8 5.5z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          className="likes-mini__btn"
          data-likes-ctrl="next"
          onClick={() => next(1)}
          aria-label={tr("transport.next")}
        >
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M16 6v12h2V6h-2zM6 18l8.5-6L6 6v12z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function LikesSheet({ onClose }: { onClose: () => void }) {
  const locale = usePlayer((s) => s.locale);
  const curTrack = usePlayer((s) => s.curTrack);
  const lyrics = usePlayer((s) => s.lyrics);
  const lyricIdx = usePlayer((s) => s.lyricIdx);
  const tr = useT(locale);
  const line = lyricIdx >= 0 ? lyrics[lyricIdx] : undefined;

  return (
    <div
      className="likes-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={likesT(locale, "openTransport")}
      onClick={onClose}
    >
      <div className="likes-sheet__card" onClick={(e) => e.stopPropagation()}>
        <div className="likes-sheet__art">
          {curTrack?.cover ? (
            <CoverImg key={String(curTrack.id)} src={curTrack.cover} size="medium" priority />
          ) : null}
        </div>
        <h2 className="likes-sheet__title">{curTrack?.name || tr("nowPlaying.pick")}</h2>
        <p className="likes-sheet__artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
        <p className="likes-sheet__lyric">{line?.orig || ""}</p>
        <Transport />
        <button type="button" className="likes-sheet__close" onClick={onClose}>
          {likesT(locale, "closeSheet")}
        </button>
      </div>
    </div>
  );
}

export function LikesLayout({ brand }: { brand: string }) {
  const setTab = usePlayer((s) => s.setTab);
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const narrow = useNarrow();
  const count = useTabCount(tab);
  const skin = usePlayer((s) => s.skin);
  const setSkin = usePlayer((s) => s.setSkin);
  const palette: LikesThemeId = isLikesThemeId(skin) ? skin : DEFAULT_LIKES_THEME;
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    setTab("favorites");
  }, [setTab]);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const mobile = window.matchMedia("(max-width: 720px)").matches;
      root.style.setProperty(
        "--search-overlay-bottom",
        mobile
          ? "calc(128px + env(safe-area-inset-bottom, 0px))"
          : "calc(76px + env(safe-area-inset-bottom, 0px))"
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

  const theme = getLikesTheme(palette);
  const vars = useMemo(() => likesThemeToCssVars(theme) as CSSProperties, [theme]);

  const pickPalette = (id: LikesThemeId) => {
    setSkin(id);
  };

  const title =
    tab === "favorites" ? likesT(locale, "homeTitle") : likesT(locale, `dest.${tab}`);

  return (
    <div
      className="likes layout-likes"
      data-layout="likes"
      data-likes-palette={palette}
      style={{
        ...vars,
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      <aside className="likes-spine">
        <div className="likes-mark">
          <div className="likes-mark__seal" aria-hidden>
            <svg className="likes-mark__heart" viewBox="0 0 24 24">
              <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z" />
            </svg>
          </div>
          <span className="likes-mark__word">{likesT(locale, "brandMark")}</span>
        </div>
        <LikesDest variant="spine" hideSearch={false} />
        <LikesPalettes palette={palette} onPick={pickPalette} />
      </aside>

      <div className="likes-stage">
        <header className="likes-top">
          <div className="likes-brand" title={brand}>
            {brand}
          </div>
          {narrow ? (
            <button
              type="button"
              className="likes-search-launch"
              aria-label={likesT(locale, "searchLaunch")}
              onClick={() => openMobileSearchFromGesture()}
            >
              <span aria-hidden>🔍</span>
            </button>
          ) : (
            <SearchBar className="likes-search" />
          )}
          <div className="likes-tools">
            <LocaleSwitcher />
            <SkinSwitcher />
          </div>
        </header>
        <div className="likes-hero">
          <h1 className="likes-hero__title">{title}</h1>
          {count != null ? (
            <span className="likes-hero__count">{likesT(locale, "count", { n: count })}</span>
          ) : null}
          {tab === "favorites" ? (
            <span className="likes-hero__blurb">{likesT(locale, "homeBlurb")}</span>
          ) : null}
        </div>
        <main className="likes-body">
          <LikesBody />
        </main>
      </div>

      <footer className="likes-tray">
        <LikesMini onOpen={() => setSheet(true)} />
        {narrow ? <LikesDest variant="bar" hideSearch /> : null}
      </footer>

      {sheet ? <LikesSheet onClose={() => setSheet(false)} /> : null}
    </div>
  );
}
