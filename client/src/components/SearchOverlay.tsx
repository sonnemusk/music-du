import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { flushSync } from "react-dom";
import { useT } from "../i18n";
import { loadRecentSearches } from "../lib/recent-searches";
import { isMobileSearchUi } from "../lib/mobile-ui";
import { usePlayer } from "../store/player";
import { TrackList } from "./TrackList";

/**
 * Mobile search layer (M-2 scheme B). Covers the list area; leaves mini/player chrome
 * via CSS bottom inset. Mount once under App; only paints when searchOpen + narrow.
 */
export function SearchOverlay() {
  const open = usePlayer((s) => s.searchOpen);
  const closeSearchOverlay = usePlayer((s) => s.closeSearchOverlay);
  const search = usePlayer((s) => s.search);
  const searching = usePlayer((s) => s.searching);
  const searchQuery = usePlayer((s) => s.searchQuery);
  const searchResults = usePlayer((s) => s.searchResults);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);

  const [q, setQ] = useState(searchQuery);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const [mobile, setMobile] = useState(() => isMobileSearchUi());
  const inputRef = useRef<HTMLInputElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // Sync draft when opening / when store query changes while open
  useEffect(() => {
    if (open) {
      setQ(searchQuery);
      setRecent(loadRecentSearches());
    }
  }, [open, searchQuery]);

  // Focus on open — layout effect stays in the open-gesture frame more often than useEffect
  useLayoutEffect(() => {
    if (!open || !mobile) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [open, mobile]);

  // history stack for Android back
  useEffect(() => {
    if (!open || !mobile) return;
    try {
      window.history.pushState({ musicSearchOverlay: 1 }, "");
      pushedRef.current = true;
    } catch {
      pushedRef.current = false;
    }
    const onPop = () => {
      pushedRef.current = false;
      closeSearchOverlay({ fromPopstate: true });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [open, mobile, closeSearchOverlay]);

  // visualViewport: keep layer in the visible keyboard-safe rect
  useEffect(() => {
    if (!open || !mobile) return;
    const layer = layerRef.current;
    if (!layer) return;
    const vv = window.visualViewport;
    const reset = () => {
      // Fall back to the stylesheet: top:0 + bottom:var(--search-overlay-bottom),
      // which keeps the mini player reachable while browsing results.
      layer.style.top = "";
      layer.style.height = "";
      layer.style.bottom = "";
    };
    const apply = () => {
      if (!vv) return reset();
      // Only take over the box while the keyboard shrinks the visual viewport;
      // otherwise the JS height would eat the reserved mini-player strip.
      const keyboardUp = window.innerHeight - vv.height > 80;
      if (!keyboardUp) return reset();
      layer.style.top = `${vv.offsetTop}px`;
      layer.style.height = `${vv.height}px`;
      layer.style.bottom = "auto";
    };
    apply();
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);
    return () => {
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
      layer.style.top = "";
      layer.style.height = "";
      layer.style.bottom = "";
    };
  }, [open, mobile]);

  if (!open || !mobile || typeof document === "undefined") return null;

  const showRecent = !q.trim() && !searching && !searchResults.length;
  const showResults = searchResults.length > 0 && !searching;
  const showEmpty =
    !searching && q.trim().length > 0 && searchResults.length === 0 && Boolean(searchQuery);
  const showSkeleton = searching;

  const body = (
    <div
      ref={layerRef}
      className="search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={tr("search.overlayAria")}
    >
      <form
        className="search-overlay__top"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void search(q);
          setRecent(loadRecentSearches());
        }}
      >
        <div className="search-overlay__actions">
          <button
            type="button"
            className="search-overlay__cancel"
            onClick={() => closeSearchOverlay()}
          >
            {tr("search.cancel")}
          </button>
          <button type="submit" className="search-overlay__go" disabled={searching}>
            {searching ? "…" : tr("search.submit")}
          </button>
        </div>
        {/* Own row so width ≥ vw−32 (验收); cancel/submit sit above */}
        <input
          ref={inputRef}
          className="search-overlay__input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tr("search.placeholder")}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          aria-label={tr("search.aria")}
        />
      </form>
      <div className="search-overlay__body">
        {showSkeleton ? (
          <div className="search-overlay__skel" aria-busy="true" aria-label={tr("search.loading")}>
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="search-overlay__skel-row" />
            ))}
          </div>
        ) : null}
        {showRecent ? (
          <div className="search-overlay__recent">
            <div className="search-overlay__label">{tr("search.recent")}</div>
            {recent.length ? (
              <div className="search-overlay__chips">
                {recent.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="search-overlay__chip"
                    onClick={() => {
                      setQ(item);
                      void search(item);
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : (
              <p className="search-overlay__hint">{tr("search.recentEmpty")}</p>
            )}
          </div>
        ) : null}
        {showResults ? (
          <TrackList tracks={searchResults} mode="search" empty={tr("empty.search")} />
        ) : null}
        {showEmpty ? (
          <div className="search-overlay__empty">
            <p>{tr("toast.noResults")}</p>
            <p className="search-overlay__hint">{tr("search.emptyHint")}</p>
          </div>
        ) : null}
        {!showSkeleton && !showRecent && !showResults && !showEmpty ? (
          <p className="search-overlay__hint">{tr("empty.search")}</p>
        ) : null}
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

/** Call from 🔍 click: open + focus in the same user gesture (iOS keyboard). */
export function openMobileSearchFromGesture() {
  flushSync(() => {
    usePlayer.getState().openSearchOverlay();
  });
  const el = document.querySelector<HTMLInputElement>(".search-overlay__input");
  el?.focus({ preventScroll: true });
}
