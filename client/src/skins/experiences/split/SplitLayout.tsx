import { useEffect, useState, type CSSProperties } from "react";
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
import { qualityShortLabel } from "../../../lib/quality";
import type { PanelTab } from "../../../lib/types";
import { usePlayer } from "../../../store/player";
import { splitT } from "./i18n";
import {
  ensureSplitFonts,
  getSplitTheme,
  splitThemeToCssVars,
} from "./theme";
import "./split.css";

const SECTIONS: PanelTab[] = [
  "favorites",
  "history",
  "search",
  "charts",
  "playlist",
  "lyrics",
];

function usePhoneChrome() {
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

function SplitPane() {
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);

  if (tab === "search") {
    return (
      <TrackList tracks={searchResults} mode="search" empty={tr("empty.search")} />
    );
  }
  if (tab === "charts") return <ChartsPanel />;
  if (tab === "playlist") {
    return (
      <TrackList tracks={playlist} mode="playlist" empty={tr("empty.playlist")} />
    );
  }
  if (tab === "favorites") {
    return (
      <TrackList tracks={favorites} mode="favorites" empty={tr("empty.favorites")} />
    );
  }
  if (tab === "history") {
    return (
      <TrackList tracks={history} mode="history" empty={tr("empty.history")} />
    );
  }
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return null;
}

function SplitSpine({ phone }: { phone: boolean }) {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  const onSection = (id: PanelTab) => {
    if (id === "search" && phone) {
      openMobileSearchFromGesture();
      return;
    }
    setTab(id);
  };

  return (
    <nav className="split-spine" aria-label={splitT(locale, "sectionsAria")} data-no-swipe>
      {SECTIONS.map((id) => {
        const on = tab === id;
        const label = tr(`tabs.${id}`);
        return (
          <button
            key={id}
            type="button"
            className={`split-spine__btn ${on ? "on" : ""}`}
            aria-current={on ? "page" : undefined}
            aria-label={tr(`tabs.${id}`)}
            onClick={() => onSection(id)}
          >
            <span className="split-spine__label">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function SplitNow({ phone }: { phone: boolean }) {
  const curTrack = usePlayer((s) => s.curTrack);
  const quality = usePlayer((s) => s.quality);
  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const playSource = usePlayer((s) => s.playSource);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const qShow = quality && quality !== "…" ? quality : preferredQuality;
  const qLabel = qualityShortLabel(qShow) || String(qShow || "").toUpperCase();

  const title = curTrack?.name || splitT(locale, "idleTitle");
  const artist = curTrack?.artist || splitT(locale, "idleArtist");

  return (
    <div
      className={`split-now now-playing ${phone ? "is-compact" : ""} ${loadingPlay ? "loading" : ""}`}
    >
      <div className={`split-cover ${curTrack?.cover ? "has" : ""}`}>
        {curTrack?.cover ? (
          <CoverImg
            key={String(curTrack.id)}
            src={curTrack.cover}
            className="split-cover__img"
            size="medium"
            priority
          />
        ) : (
          <span className="split-cover__idle" aria-hidden>
            ♪
          </span>
        )}
      </div>
      <div className="split-now__text">
        <h1 className="split-now__title" title={title}>
          {title}
        </h1>
        <p className="split-now__artist" title={artist}>
          {artist}
        </p>
        {curTrack && !phone ? (
          <div className="split-now__badges">
            {loadingPlay ? <span className="badge">{tr("nowPlaying.switching")}</span> : null}
            {qLabel ? (
              <span className="badge" title={tr("nowPlaying.qualityTitle")}>
                {qLabel}
              </span>
            ) : null}
            {playSource ? (
              <span className="badge">
                {playSource === "remote" ? tr("nowPlaying.remote") : tr("nowPlaying.proxy")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SplitLayout({ brand }: { brand: string }) {
  const phone = usePhoneChrome();
  const skin = usePlayer((s) => s.skin);
  const locale = usePlayer((s) => s.locale);
  const theme = getSplitTheme(skin);
  const vars = splitThemeToCssVars(theme) as CSSProperties;
  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : theme.nameEn;

  useEffect(() => {
    ensureSplitFonts(theme);
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const applied = splitThemeToCssVars(theme);
    for (const [k, v] of Object.entries(applied)) root.style.setProperty(k, v);
    root.style.setProperty(
      "--search-overlay-bottom",
      "max(8px, env(safe-area-inset-bottom, 0px))"
    );
    return () => {
      for (const k of Object.keys(applied)) root.style.removeProperty(k);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, [theme]);

  return (
    <div
      className="split-root"
      data-layout="split"
      data-split-theme={theme.id}
      data-split-mode={phone ? "stacked" : "two-pane"}
      data-phone={phone ? "1" : undefined}
      style={{
        ...vars,
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      <div className="split-desk">
        <section className="split-player" aria-label={splitT(locale, "playerAria")}>
          <header className="split-player__head">
            <div className="split-brand" title={brand}>
              <span className="split-brand__mark">{mark}</span>
              <span className="split-brand__exp">{splitT(locale, "experience")}</span>
              {themeName ? <span className="split-brand__theme">{themeName}</span> : null}
              <span className="split-brand__together">{splitT(locale, "together")}</span>
            </div>
            <div className="split-tools">
              {phone ? (
                <button
                  type="button"
                  className="split-search-launch"
                  aria-label={splitT(locale, "searchLaunch")}
                  title={splitT(locale, "searchLaunch")}
                  onClick={() => openMobileSearchFromGesture()}
                >
                  <span aria-hidden>⌕</span>
                </button>
              ) : null}
              <LocaleSwitcher />
              <SkinSwitcher />
            </div>
          </header>
          <div className="split-player__stage">
            <SplitNow phone={phone} />
            <div className="split-transport">
              <Transport />
            </div>
          </div>
        </section>

        <SplitSpine phone={phone} />

        <section className="split-list" aria-label={splitT(locale, "listAria")}>
          {!phone ? (
            <div className="split-list__search">
              <SearchBar className="split-search" />
            </div>
          ) : null}
          <div className="split-pane">
            <SplitPane />
          </div>
        </section>
      </div>
    </div>
  );
}
