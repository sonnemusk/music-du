import { useEffect, useState, type CSSProperties, type JSX } from "react";
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
import { rt } from "./i18n";
import "./recent.css";

type IconProps = { className?: string };

const ICONS: Record<PanelTab, (p: IconProps) => JSX.Element> = {
  history: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M7 18c2.2-2.4 3.4-4.6 3.4-7.2 0-2.2-1-3.8-2.6-3.8S5.2 8.6 5.6 11c.5 3 2.2 5 4.8 7" />
      <path d="M14.2 18c2-2.2 3.2-4.4 3.2-6.8 0-2-1-3.4-2.4-3.4s-2.4 1.4-2 3.6c.4 2.6 1.8 4.4 4 6.6" />
      <circle cx="9.2" cy="8.2" r="1.1" />
      <circle cx="15.2" cy="8.6" r="1.1" />
    </svg>
  ),
  favorites: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 19.2S5.4 15 5.4 10.4A3.6 3.6 0 0 1 12 8.2a3.6 3.6 0 0 1 6.6 2.2C18.6 15 12 19.2 12 19.2z" />
    </svg>
  ),
  search: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <circle cx="11" cy="11" r="6.2" />
      <path d="M15.8 15.8L20 20" />
    </svg>
  ),
  charts: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M6 17V11M12 17V7M18 17v-4" />
    </svg>
  ),
  playlist: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M5 7.5h10M5 12h10M5 16.5h6" />
      <circle cx="17.5" cy="16" r="2.2" />
      <path d="M19.7 16V9.2l-2.6.8" />
    </svg>
  ),
  lyrics: (p) => (
    <svg {...p} viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M7 6.5h11M7 11h8M7 15.5h10M7 20h5" />
    </svg>
  ),
};

const RAIL: PanelTab[] = [
  "history",
  "favorites",
  "search",
  "charts",
  "playlist",
  "lyrics",
];

function usePhone() {
  const [phone, setPhone] = useState(() => isMobileSearchUi());
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setPhone(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  return phone;
}

function useSectionCount(tab: PanelTab): number | null {
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

function RecentRail() {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const phone = usePhone();

  const labelFor = (id: PanelTab) => {
    if (id === "history") return phone ? rt(locale, "historyNavShort") : rt(locale, "historyNav");
    return phone ? tr(`tabs.${id}Short`) : tr(`tabs.${id}`);
  };

  const go = (id: PanelTab) => {
    setTab(id);
    if (id === "search" && isMobileSearchUi()) openMobileSearchFromGesture();
  };

  return (
    <nav className="rec-rail" aria-label={rt(locale, "navAria")} data-no-swipe>
      {RAIL.map((id) => {
        const Icon = ICONS[id];
        const on = tab === id;
        return (
          <button
            key={id}
            type="button"
            className={`rec-rail__item ${on ? "on" : ""}`}
            aria-current={on ? "page" : undefined}
            aria-label={labelFor(id)}
            title={labelFor(id)}
            onClick={() => go(id)}
          >
            <span className="rec-rail__icon">
              <Icon className="rec-icon" />
            </span>
            <span className="rec-rail__label">{labelFor(id)}</span>
          </button>
        );
      })}
    </nav>
  );
}

function RecentBody() {
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
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return (
    <TrackList
      tracks={history}
      mode="history"
      empty={rt(locale, "emptyHistory")}
      coverSize="thumb"
      className="track-list rec-tape"
    />
  );
}

function RecentMini() {
  const curTrack = usePlayer((s) => s.curTrack);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  return (
    <aside
      className={`rec-mini player-bar ${loadingPlay ? "loading" : ""}`}
      aria-label={rt(locale, "miniAria")}
    >
      <button
        type="button"
        className={`rec-mini__art ${curTrack?.cover ? "has" : ""}`}
        onClick={() => setTab("lyrics")}
        aria-label={tr("tabs.lyrics")}
        title={tr("tabs.lyrics")}
      >
        {curTrack?.cover ? (
          <CoverImg
            key={String(curTrack.id)}
            src={curTrack.cover}
            size="medium"
            priority
          />
        ) : (
          <span className="rec-mini__note" aria-hidden>
            ♪
          </span>
        )}
      </button>
      <div className="rec-mini__meta">
        <p className="rec-mini__kicker">{rt(locale, "resume")}</p>
        <h2 className="rec-mini__title">
          {curTrack?.name || rt(locale, "idleTitle")}
        </h2>
        <p className="rec-mini__artist">
          {curTrack?.artist || rt(locale, "idleArtist")}
        </p>
      </div>
      <div className="rec-mini__transport player-bar__controls">
        <Transport />
      </div>
    </aside>
  );
}

export function RecentLayout({ brand }: { brand: string }) {
  const setTab = usePlayer((s) => s.setTab);
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const phone = usePhone();
  const count = useSectionCount(tab);

  useEffect(() => {
    setTab("history");
  }, [setTab]);

  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";

  const tapeVars = {
    "--rec-now-label": JSON.stringify(rt(locale, "justNow")),
    "--rec-earlier-label": JSON.stringify(rt(locale, "earlier")),
  } as CSSProperties;

  const sectionTitle =
    tab === "history" ? rt(locale, "historyTitle") : tr(`tabs.${tab}`);

  return (
    <div
      className="layout layout-recent"
      data-section={tab}
      data-phone={phone ? "1" : undefined}
    >
      <header className="rec-top">
        <div className="rec-brand" title={brand}>
          <span className="rec-brand__mark">{rt(locale, "brandMark")}</span>
          <span className="rec-brand__dot" aria-hidden />
          <span className="rec-brand__host">{mark}</span>
          {themeName ? (
            <span className="rec-brand__theme">{themeName}</span>
          ) : null}
        </div>
        {phone ? (
          <button
            type="button"
            className="rec-search-launch"
            aria-label={tr("search.aria")}
            title={tr("search.aria")}
            onClick={() => openMobileSearchFromGesture()}
          >
            <span aria-hidden>🔍</span>
          </button>
        ) : (
          <SearchBar className="rec-search" />
        )}
        <div className="rec-tools">
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </header>

      <div className="rec-stage">
        <RecentRail />
        <main className="rec-main">
          {tab === "history" ? (
            <header className="rec-hero">
              <p className="rec-hero__kicker">{rt(locale, "kicker")}</p>
              <h1 className="rec-hero__title">{rt(locale, "historyTitle")}</h1>
              <p className="rec-hero__lead">
                {count != null ? (
                  <span className="rec-hero__count">
                    {rt(locale, "count", { n: count })}
                  </span>
                ) : null}
                <span>{rt(locale, "historyLead")}</span>
              </p>
            </header>
          ) : tab !== "charts" ? (
            <header className="rec-hero rec-hero--plain">
              <h1 className="rec-hero__title">{sectionTitle}</h1>
              {count != null ? (
                <span className="rec-hero__count">
                  {rt(locale, "count", { n: count })}
                </span>
              ) : null}
            </header>
          ) : null}
          <div
            className={`rec-body ${tab === "history" ? "rec-body--history" : ""}`}
            style={tab === "history" ? tapeVars : undefined}
          >
            <RecentBody />
          </div>
        </main>
      </div>

      <RecentMini />
    </div>
  );
}
