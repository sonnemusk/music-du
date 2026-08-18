import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  SKINS,
  themeDisplayName,
  themeDisplayTagline,
  type SkinId,
} from "../lib/types";
import { LAYOUT_IDS, LAYOUT_META, type SkinLayout } from "../skins/layouts/layout-ids";
import { useT } from "../i18n";
import { usePlayer } from "../store/player";
import { isMobileSearchUi } from "../lib/mobile-ui";
import { loadSkinRecents, pushSkinRecent } from "../lib/skin-recents";

/** Keep the portaled theme list on-screen for header-right and other anchors. */
function themePanelStyle(anchor: DOMRect): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const gap = 8;
  const panelW = Math.min(460, vw - 24);
  const cap = Math.min(vh * 0.78, 640);
  const spaceBelow = vh - anchor.bottom - gap;
  const spaceAbove = anchor.top - gap;
  const openAbove = spaceBelow < Math.min(280, cap) && spaceAbove > spaceBelow;

  let top: number;
  let maxHeight: number;
  if (openAbove) {
    maxHeight = Math.min(cap, Math.max(160, spaceAbove));
    top = Math.max(gap, anchor.top - maxHeight - gap);
  } else {
    top = anchor.bottom + gap;
    maxHeight = Math.min(cap, Math.max(160, vh - top - gap));
    if (top + maxHeight > vh - gap) {
      top = Math.max(gap, vh - maxHeight - gap);
    }
  }

  const preferLeft = anchor.left < vw / 2;
  const left = preferLeft
    ? Math.max(gap, Math.min(anchor.left, vw - panelW - gap))
    : Math.max(gap, Math.min(anchor.right - panelW, vw - panelW - gap));

  return {
    position: "fixed",
    top,
    left,
    right: "auto",
    zIndex: 2000,
    maxHeight,
    overflow: "auto",
    width: panelW,
  };
}

/**
 * Theme switcher — sits in .skin-head__tools.
 * Desktop: anchored portal panel. Mobile (M-8): bottom drawer with layout chips + close.
 */
export function SkinSwitcher() {
  const skin = usePlayer((s) => s.skin);
  const open = usePlayer((s) => s.skinOpen);
  const setSkin = usePlayer((s) => s.setSkin);
  const cycleSkin = usePlayer((s) => s.cycleSkin);
  const setSkinOpen = usePlayer((s) => s.setSkinOpen);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const meta = SKINS.find((x) => x.id === skin) || SKINS[0];
  const [q, setQ] = useState("");
  const [layoutFilter, setLayoutFilter] = useState<SkinLayout | "all">(
    () => (SKINS.find((x) => x.id === skin)?.layout as SkinLayout) || "all"
  );
  const [recents, setRecents] = useState<string[]>(() => loadSkinRecents());
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [mobile, setMobile] = useState(() => isMobileSearchUi());
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return SKINS.filter((t) => {
      if (layoutFilter !== "all" && t.layout !== layoutFilter) return false;
      if (!s) return true;
      const name = themeDisplayName(t, locale).toLowerCase();
      const tag = themeDisplayTagline(t, locale).toLowerCase();
      return (
        name.includes(s) ||
        tag.includes(s) ||
        t.id.toLowerCase().includes(s) ||
        t.name.toLowerCase().includes(s) ||
        t.tagline.toLowerCase().includes(s)
      );
    });
  }, [q, layoutFilter, locale]);

  const layoutCount = useMemo(() => new Set(SKINS.map((t) => t.layout)).size, []);

  // Measure button group for desktop portal position
  useEffect(() => {
    if (!open || mobile) {
      if (!open) setAnchor(null);
      return;
    }
    const el = document.querySelector(".skin-switcher__bar");
    if (el) setAnchor(el.getBoundingClientRect());
    const onResize = () => {
      const node = document.querySelector(".skin-switcher__bar");
      if (node) setAnchor(node.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, mobile]);

  // Focus management when open
  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(t);
      prevFocus.current?.focus?.();
    };
  }, [open]);

  // Focus trap (Tab cycles inside panel)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const lay = SKINS.find((x) => x.id === skin)?.layout as SkinLayout | undefined;
    if (lay) setLayoutFilter(lay);
    setRecents(loadSkinRecents());
  }, [open, skin]);

  const pick = (id: SkinId) => {
    setSkin(id);
    setRecents(pushSkinRecent(id));
    if (mobile) setSkinOpen(false);
  };

  const recentThemes = recents
    .map((id) => SKINS.find((s) => s.id === id))
    .filter((s): s is (typeof SKINS)[number] => Boolean(s));

  const layouts: Array<SkinLayout | "all"> = ["all", ...LAYOUT_IDS];

  const panelBody = (
    <>
      {mobile ? (
        <div className="skin-panel__drawer-handle" aria-hidden>
          <span />
        </div>
      ) : null}
      <div className="skin-panel__head">
        <div className="skin-panel__hint">
          {tr("skin.hint", { n: SKINS.length, layouts: layoutCount })}
        </div>
        {mobile ? (
          <button
            type="button"
            className="skin-panel__close"
            aria-label={tr("skin.close")}
            onClick={() => setSkinOpen(false)}
          >
            ×
          </button>
        ) : null}
      </div>
      <input
        ref={searchRef}
        className="skin-panel__search"
        type="search"
        enterKeyHint="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={tr("skin.filterPh")}
        autoComplete="off"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <div className="skin-panel__layout-chips" data-no-swipe>
        {layouts.map((id) => (
          <button
            key={id}
            type="button"
            className={`skin-panel__layout-chip ${layoutFilter === id ? "on" : ""}`}
            onClick={() => setLayoutFilter(id)}
          >
            {id === "all" ? tr("skin.filterAll") : tr(`layout.${id}`)}
          </button>
        ))}
      </div>
      {!q && recentThemes.length ? (
        <div className="skin-panel__recents">
          <div className="skin-panel__recents-label">{tr("skin.recents")}</div>
          <div className="skin-panel__recents-row" data-no-swipe>
            {recentThemes.map((s) => (
              <button
                key={`recent-${s.id}`}
                type="button"
                className={`skin-panel__recent ${skin === s.id ? "on" : ""}`}
                style={{ ["--skin-accent" as string]: s.accent }}
                onClick={() => pick(s.id as SkinId)}
              >
                <span className="skin-switcher__dot" style={{ background: s.accent }} />
                {themeDisplayName(s, locale)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className={`skin-panel__grid ${mobile ? "skin-panel__grid--compact" : ""}`}>
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`skin-card ${skin === s.id ? "active" : ""}`}
            style={{ ["--skin-accent" as string]: s.accent }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pick(s.id as SkinId);
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              pick(s.id as SkinId);
            }}
          >
            <div className="skin-card__swatch" style={{ background: s.accent }} />
            <div className="skin-card__layout-thumb" data-layout={s.layout} aria-hidden>
              <span className="skin-card__layout-a" />
              <span className="skin-card__layout-b" />
            </div>
            <div className="skin-card__name">{themeDisplayName(s, locale)}</div>
            {!mobile ? (
              <div className="skin-card__tag">
                {LAYOUT_META[s.layout]?.name
                  ? tr("skin.layoutPrefix", { name: tr(`layout.${s.layout}`) })
                  : ""}
                {themeDisplayTagline(s, locale)}
              </div>
            ) : (
              <div className="skin-card__tag">{tr(`layout.${s.layout}`)}</div>
            )}
          </button>
        ))}
      </div>
      {!filtered.length && <div className="skin-panel__empty">{tr("empty.themes")}</div>}
    </>
  );

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            className={`skin-panel skin-panel--portal ${mobile ? "skin-panel--drawer" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={tr("skin.dialogAria")}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={mobile ? undefined : anchor ? themePanelStyle(anchor) : undefined}
          >
            {panelBody}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="skin-switcher" style={{ ["--skin-accent" as string]: meta.accent }}>
      <div className="skin-switcher__bar">
        {/* F-5: primary = open theme list; cycle is secondary */}
        <button
          type="button"
          className={`skin-switcher__btn primary ${open ? "on" : ""}`}
          title={tr("skin.openList")}
          onClick={() => setSkinOpen(!open)}
        >
          <span className="skin-switcher__dot" style={{ background: meta.accent }} />
          <span className="skin-switcher__label">
            <span className="skin-switcher__label-full">
              {tr("skin.theme", { name: themeDisplayName(meta, locale) })}
            </span>
            <span className="skin-switcher__label-short">
              {themeDisplayName(meta, locale)}
            </span>
          </span>
        </button>
        <button
          type="button"
          className="skin-switcher__btn skin-switcher__cycle"
          title={tr("skin.cycleTitle")}
          aria-label={tr("skin.cycleTitle")}
          onClick={cycleSkin}
        >
          <span className="skin-switcher__label-full">{tr("skin.cycle")}</span>
          <span className="skin-switcher__label-short" aria-hidden>
            ↻
          </span>
        </button>
      </div>
      {panel}
    </div>
  );
}
