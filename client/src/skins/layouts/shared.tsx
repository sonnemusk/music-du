import { useEffect, useState, type ReactNode } from "react";
import { ChartsPanel } from "../../components/ChartsPanel";
import { CoverImg } from "../../components/CoverImg";
import { LocaleSwitcher } from "../../components/LocaleSwitcher";
import { LyricsView } from "../../components/LyricsView";
import { QualityPicker } from "../../components/QualityPicker";
import { openMobileSearchFromGesture } from "../../components/SearchOverlay";
import { SearchBar } from "../../components/SearchBar";
import { SkinSwitcher } from "../../components/SkinSwitcher";
import { TrackList } from "../../components/TrackList";
import { Transport } from "../../components/Transport";
import { useT } from "../../i18n";
import { isMobileSearchUi } from "../../lib/mobile-ui";
import { qualityShortLabel } from "../../lib/quality";
import type { PanelTab } from "../../lib/types";
import { usePlayer } from "../../store/player";
import { getTheme } from "../theme-catalog";

/** Classic shells: reserve the stacked mini player so the search portal does not cover it. */
export function useSearchOverlayBottom(cssValue: string) {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const narrow = window.matchMedia("(max-width: 860px)").matches;
      root.style.setProperty(
        "--search-overlay-bottom",
        narrow ? cssValue : "calc(72px + env(safe-area-inset-bottom, 0px))"
      );
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      root.style.removeProperty("--search-overlay-bottom");
    };
  }, [cssValue]);
}

function useMobileSearchChrome() {
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

export function useTabs(opts?: { hideSearch?: boolean }) {
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const all = [
    { id: "search" as PanelTab, label: tr("tabs.search"), short: tr("tabs.searchShort") },
    { id: "charts" as PanelTab, label: tr("tabs.charts"), short: tr("tabs.chartsShort") },
    { id: "playlist" as PanelTab, label: tr("tabs.playlist"), short: tr("tabs.playlistShort") },
    {
      id: "favorites" as PanelTab,
      label: tr("tabs.favorites"),
      short: tr("tabs.favoritesShort"),
    },
    { id: "history" as PanelTab, label: tr("tabs.history"), short: tr("tabs.historyShort") },
    { id: "lyrics" as PanelTab, label: tr("tabs.lyrics"), short: tr("tabs.lyricsShort") },
  ];
  if (opts?.hideSearch) return all.filter((t) => t.id !== "search");
  return all;
}

export function usePanelBody() {
  const tab = usePlayer((s) => s.tab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const searchResults = usePlayer((s) => s.searchResults);
  const playlist = usePlayer((s) => s.playlist);
  const favorites = usePlayer((s) => s.favorites);
  const history = usePlayer((s) => s.history);
  const skin = usePlayer((s) => s.skin);
  const coverSize = getTheme(skin).layout === "gallery" ? "medium" : "thumb";

  if (tab === "search")
    return (
      <TrackList
        tracks={searchResults}
        mode="search"
        empty={tr("empty.search")}
        coverSize={coverSize}
      />
    );
  if (tab === "charts") return <ChartsPanel coverSize={coverSize} />;
  if (tab === "playlist")
    return (
      <TrackList
        tracks={playlist}
        mode="playlist"
        empty={tr("empty.playlist")}
        coverSize={coverSize}
      />
    );
  if (tab === "favorites")
    return (
      <TrackList
        tracks={favorites}
        mode="favorites"
        empty={tr("empty.favorites")}
        coverSize={coverSize}
      />
    );
  if (tab === "history")
    return (
      <TrackList
        tracks={history}
        mode="history"
        empty={tr("empty.history")}
        coverSize={coverSize}
      />
    );
  if (tab === "lyrics") return <LyricsView variant="panel" />;
  return null;
}

export function TabNav({ short }: { short?: boolean }) {
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const mobile = useMobileSearchChrome();
  const tabs = useTabs({ hideSearch: mobile });
  // M-10: mobile never uses 1-char short labels — keep ≥2 字 full labels, scroll row
  const useShort = Boolean(short) && !mobile;
  return (
    <nav className="skin-tabs" aria-label={tr("tabs.navAria")} data-no-swipe>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={tab === t.id ? "on" : ""}
          onClick={() => setTab(t.id)}
        >
          {useShort ? t.short : t.label}
        </button>
      ))}
    </nav>
  );
}

export function NowPlaying({
  large,
  inline,
  hideBadges,
}: {
  large?: boolean;
  /** Horizontal compact strip (cover | text | badges) for player bars */
  inline?: boolean;
  hideBadges?: boolean;
}) {
  const curTrack = usePlayer((s) => s.curTrack);
  const quality = usePlayer((s) => s.quality);
  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const playSource = usePlayer((s) => s.playSource);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  const showBadges = !hideBadges;
  // Display-only chip — switching lives on the transport QualityPicker only
  const qShow = quality && quality !== "…" ? quality : preferredQuality;
  const qLabel = qualityShortLabel(qShow) || String(qShow || "").toUpperCase();
  const badges = showBadges ? (
    <div className="np-badges">
      {loadingPlay ? <span className="badge">{tr("nowPlaying.switching")}</span> : null}
      {qLabel ? (
        <QualityPicker className="quality-wrap--keep np-quality" />
      ) : null}
      {playSource ? (
        <span className="badge">
          {playSource === "remote" ? tr("nowPlaying.remote") : tr("nowPlaying.proxy")}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      className={`now-playing ${large ? "lg" : ""} ${inline ? "inline" : ""} ${loadingPlay ? "loading" : ""}`}
    >
      <div className={`np-cover ${curTrack?.cover ? "has" : ""}`}>
        {curTrack?.cover ? (
          <CoverImg
            key={String(curTrack.id)}
            src={curTrack.cover}
            className="np-cover-img"
            size="medium"
            priority
          />
        ) : (
          <span>♪</span>
        )}
      </div>
      <div className="np-text">
        <h1 className="np-title">{curTrack?.name || tr("nowPlaying.pick")}</h1>
        <p className="np-artist">{curTrack?.artist || tr("nowPlaying.pick")}</p>
        {badges}
      </div>
    </div>
  );
}

/**
 * Unified top chrome for ALL layouts (side / compact / immersive).
 * Desktop: brand · search · theme tools
 * Mobile (≤720): brand · 🔍 · theme tools — search lives in SearchOverlay (scheme B)
 * Row 2: tabs (optional; mobile hides the search tab)
 */
export function SkinHead({
  brand,
  tabs = "full",
  title,
}: {
  brand: string;
  tabs?: "full" | "short" | "none";
  /** optional title under brand row (dock style) */
  title?: string;
}) {
  // brand is usually "Music · 主题名" — split so we never show "Mu..."
  const parts = brand.split("·").map((s) => s.trim());
  const mark = parts[0] || "Music";
  const themeName = parts.length > 1 ? parts.slice(1).join(" · ") : "";
  const mobile = useMobileSearchChrome();
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  return (
    <header className="skin-head" data-mobile-search={mobile ? "1" : undefined}>
      <div className="skin-head__main">
        <div className="skin-brand" title={brand}>
          <span className="skin-brand__mark">{mark}</span>
          {themeName ? (
            <>
              <span className="skin-brand__sep" aria-hidden>
                ·
              </span>
              <span className="skin-brand__theme">{themeName}</span>
            </>
          ) : null}
        </div>
        {mobile ? (
          <button
            type="button"
            className="skin-search-launch"
            aria-label={tr("search.aria")}
            title={tr("search.aria")}
            onClick={() => openMobileSearchFromGesture()}
          >
            <span aria-hidden>🔍</span>
          </button>
        ) : (
          <SearchBar className="skin-search" />
        )}
        <div className="skin-head__tools">
          <LocaleSwitcher />
          <SkinSwitcher />
        </div>
      </div>
      {title ? <h1 className="skin-head__title">{title}</h1> : null}
      {tabs === "full" ? (
        <div className="skin-head__nav">
          <TabNav />
        </div>
      ) : null}
      {tabs === "short" ? (
        <div className="skin-head__nav">
          <TabNav short />
        </div>
      ) : null}
    </header>
  );
}

export function SkinChrome({
  brand,
  children,
}: {
  brand: string;
  children: ReactNode;
}) {
  return (
    <>
      <SkinHead brand={brand} />
      {children}
      <div className="skin-transport">
        <Transport />
      </div>
    </>
  );
}
