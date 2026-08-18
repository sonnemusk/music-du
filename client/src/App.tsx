import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AudioEngine } from "./components/AudioEngine";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MediaSession } from "./components/MediaSession";
import { Toast } from "./components/Toast";
import { isMobileSearchUi } from "./lib/mobile-ui";
import { attachSwipeNav } from "./lib/swipe-nav";
import { getTheme } from "./skins/theme-catalog";
import { SkinHost } from "./skins/SkinHost";
import { t, useT } from "./i18n";
import { usePlayer } from "./store/player";

const SearchOverlay = lazy(() =>
  import("./components/SearchOverlay").then((m) => ({ default: m.SearchOverlay }))
);

export default function App() {
  const skin = usePlayer((s) => s.skin);
  const bootstrap = usePlayer((s) => s.bootstrap);
  const setSkinOpen = usePlayer((s) => s.setSkinOpen);
  const skinOpen = usePlayer((s) => s.skinOpen);
  const next = usePlayer((s) => s.next);
  const libraryReadOnly = usePlayer((s) => s.libraryReadOnly);
  const isDemoSite = usePlayer((s) => s.isDemoSite);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const shellRef = useRef<HTMLDivElement>(null);
  const [demoBanner, setDemoBanner] = useState(readDemoBannerOpen);
  const showDemoBanner = isDemoSite && demoBanner;

  const showToast = usePlayer((s) => s.showToast);
  const reloadLibrary = usePlayer((s) => s.reloadLibrary);
  const searchOpen = usePlayer((s) => s.searchOpen);
  const [mobileSearch, setMobileSearch] = useState(() => isMobileSearchUi());
  const [searchLayerOnce, setSearchLayerOnce] = useState(false);
  const searchLayerReady = searchLayerOnce || (searchOpen && mobileSearch);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setMobileSearch(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (searchOpen && mobileSearch) setSearchLayerOnce(true);
  }, [searchOpen, mobileSearch]);

  useEffect(() => {
    void (async () => {
      await bootstrap();
      // /import success redirects here: /?imported=N&total=M
      try {
        const q = new URLSearchParams(window.location.search);
        if (!q.has("imported")) return;
        const added = Number(q.get("imported") || 0);
        const total = Number(q.get("total") || 0);
        const skipped = Number(q.get("skipped") || 0);
        const failed = Number(q.get("failed") || 0);
        const capped = Number(q.get("capped") || 0);
        await reloadLibrary();
        const parts: string[] = [];
        if (added > 0) parts.push(t("import.added", { n: added }));
        else parts.push(t("import.none"));
        if (total) parts.push(t("import.total", { n: total }));
        if (skipped) parts.push(t("import.skipped", { n: skipped }));
        if (failed) parts.push(t("import.failed", { n: failed }));
        if (capped) parts.push(t("import.capped", { n: capped }));
        showToast(parts.join(" · "));
        // Clean query so refresh doesn't re-toast
        const url = new URL(window.location.href);
        for (const k of ["imported", "total", "skipped", "failed", "matched", "capped"]) {
          url.searchParams.delete(k);
        }
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      } catch {
        /* */
      }
    })();
  }, [bootstrap, reloadLibrary, showToast]);

  // Touch: swipe on now-playing / mini bar only (M-11 — not full shell)
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const cleanups: Array<() => void> = [];
    const bind = () => {
      for (const c of cleanups.splice(0)) c();
      const nodes = shell.querySelectorAll<HTMLElement>(
        ".side-player, .imm-now, .compact-now, .player-bar, .now-playing, .gal-dock, .dock-mini, .desk-dock, .feed-reel, .stage-floor, .verse-dock, .likes-mini, .rec-mini, .find-mini, .boards-mini, .split-player"
      );
      const seen = new Set<HTMLElement>();
      nodes.forEach((node) => {
        if (seen.has(node)) return;
        seen.add(node);
        cleanups.push(
          attachSwipeNav(node, {
            onSwipeLeft: () => next(1),
            onSwipeRight: () => next(-1),
          })
        );
      });
    };
    bind();
    const mo = new MutationObserver(() => bind());
    mo.observe(shell, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      for (const c of cleanups) c();
    };
  }, [next, skin]);

  useEffect(() => {
    const meta = getTheme(skin);
    const el = document.querySelector('meta[name="theme-color"]');
    if (el) el.setAttribute("content", meta.themeColor);
    document.documentElement.dataset.skin = skin;
    document.documentElement.style.colorScheme = isLightTheme(meta.bg) ? "light" : "dark";
  }, [skin]);

  // Click outside theme panel to close
  // Panel is portaled to document.body (.skin-panel--portal), so it is NOT
  // inside .skin-switcher — must exclude both, or mousedown closes the panel
  // before the card's click fires (manual pick appears broken; cycle still works).
  useEffect(() => {
    if (!skinOpen) return;
    const onDown = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest(".skin-switcher")) return;
      if (t.closest(".skin-panel")) return;
      setSkinOpen(false);
    };
    // M-8: pointer/touch as well as mouse
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [skinOpen, setSkinOpen]);

  return (
    <div
      className="app-shell"
      ref={shellRef}
      data-readonly={libraryReadOnly ? "1" : undefined}
      data-demo-banner={showDemoBanner ? "1" : undefined}
    >
      {showDemoBanner ? (
        <div className="demo-readonly-banner" role="status">
          <span className="demo-readonly-banner__msg">{tr("demo.banner")}</span>
          <button
            type="button"
            className="demo-readonly-banner__close"
            aria-label={tr("demo.bannerClose")}
            title={tr("demo.bannerClose")}
            onClick={() => {
              persistDemoBannerClosed();
              setDemoBanner(false);
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <SkinHost skin={skin} />
      {searchLayerReady ? (
        <Suspense fallback={null}>
          <SearchOverlay />
        </Suspense>
      ) : null}
      <AudioEngine />
      <KeyboardShortcuts />
      <MediaSession />
      <Toast />
    </div>
  );
}

const DEMO_BANNER_KEY = "kazam.v2.demoBannerDismissed";

function readDemoBannerOpen() {
  try {
    return localStorage.getItem(DEMO_BANNER_KEY) !== "1";
  } catch {
    return true;
  }
}

function persistDemoBannerClosed() {
  try {
    localStorage.setItem(DEMO_BANNER_KEY, "1");
  } catch {
    /* */
  }
}

function isLightTheme(bg: string): boolean {
  const hex = bg.trim();
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return false;
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
