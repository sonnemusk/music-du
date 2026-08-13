import { useEffect, useState, type JSX } from "react";
import { CoverImg } from "../../components/CoverImg";
import { Transport } from "../../components/Transport";
import { useT } from "../../i18n";
import { isMobileSearchUi } from "../../lib/mobile-ui";
import type { PanelTab } from "../../lib/types";
import { usePlayer } from "../../store/player";
import { SkinHead, useTabs, usePanelBody } from "./shared";
import "./gallery.css";

/**
 * Gallery — a browsing-first shell, unlike the three player-first layouts.
 *
 *   desktop   rail (labels) │ cover grid          │ dock
 *   tablet    rail (icons)  │ cover grid          │ dock, or bar when portrait
 *   phone     cover grid, nav as a bottom bar, now-playing as a mini bar
 *
 * The grid is CSS over the shared TrackList, so play/locate/prefetch behaviour is
 * identical to every other skin.
 */

type IconProps = { className?: string };

const ICONS: Record<PanelTab, (p: IconProps) => JSX.Element> = {
  search: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  ),
  charts: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4.5 19.5v-6M10 19.5V7M15.5 19.5v-9M21 19.5V4.5" />
    </svg>
  ),
  playlist: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M4 7h11M4 12h11M4 17h7" />
      <circle cx="18" cy="16.5" r="2.5" />
      <path d="M20.5 16.5V8l-3 1" />
    </svg>
  ),
  favorites: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 20s-7-4.4-7-9.2A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.8C19 15.6 12 20 12 20z" />
    </svg>
  ),
  history: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  ),
  lyrics: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M5 5h14M5 10h9M5 15h11M5 20h6" />
    </svg>
  ),
};

/** Tracks the current tab's item count so the header can show it. */
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

function GalleryRail() {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const mobile = useMobileChrome();
  // Phone search lives in the header lens (M-2), so the rail drops that entry.
  const tabs = useTabs({ hideSearch: mobile });

  return (
    <nav className="gal-rail" aria-label={tr("tabs.navAria")} data-no-swipe>
      {tabs.map((t) => {
        const Icon = ICONS[t.id];
        const on = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            className={`gal-rail__item ${on ? "on" : ""}`}
            aria-current={on ? "page" : undefined}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTab(t.id)}
          >
            <span className="gal-rail__icon">
              <Icon className="gal-icon" />
            </span>
            <span className="gal-rail__label">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
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

/** Right-hand player. Collapses to a bar under 1024px via CSS only. */
function GalleryDock() {
  const curTrack = usePlayer((s) => s.curTrack);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const lyrics = usePlayer((s) => s.lyrics);
  const lyricIdx = usePlayer((s) => s.lyricIdx);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  const line = lyricIdx >= 0 ? lyrics[lyricIdx] : undefined;

  return (
    <aside className={`gal-dock ${loadingPlay ? "loading" : ""}`}>
      <p className="gal-dock__label">{tr("gallery.dock")}</p>
      <button
        type="button"
        className={`gal-dock__art ${curTrack?.cover ? "has" : ""}`}
        onClick={() => setTab("lyrics")}
        aria-label={tr("tabs.lyrics")}
        title={tr("tabs.lyrics")}
      >
        {curTrack?.cover ? (
          <CoverImg key={String(curTrack.id)} src={curTrack.cover} size="medium" priority />
        ) : (
          <span className="gal-dock__note" aria-hidden>
            ♪
          </span>
        )}
      </button>
      <div className="gal-dock__meta">
        <h2 className="gal-dock__title">{curTrack?.name || tr("nowPlaying.pick")}</h2>
        <p className="gal-dock__artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
      </div>
      <p className="gal-dock__lyric" aria-live="off">
        {line?.orig || ""}
      </p>
      <Transport />
    </aside>
  );
}

export function GalleryLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const tabs = useTabs();
  const count = useTabCount(tab);
  const title = tabs.find((t) => t.id === tab)?.label || "";

  return (
    <div className="layout layout-gallery">
      <SkinHead brand={brand} tabs="none" />
      {/* One dock in the DOM; CSS turns it into a docked column, a tablet bar,
          or a phone mini bar. */}
      <div className="gal-shell">
        <GalleryRail />
        <main className="gal-main">
          <header className="gal-main__head">
            <h1 className="gal-main__title">{title}</h1>
            {count != null ? (
              <span className="gal-main__count">{tr("gallery.count", { n: count })}</span>
            ) : null}
          </header>
          <div className="gal-body">{body}</div>
        </main>
        <GalleryDock />
      </div>
    </div>
  );
}
