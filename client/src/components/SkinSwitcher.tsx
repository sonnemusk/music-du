import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SKINS, type SkinId } from "../lib/types";
import { LAYOUT_META, type SkinLayout } from "../skins/layouts/layout-ids";
import { useT } from "../i18n";
import { usePlayer } from "../store/player";
import { isMobileSearchUi } from "../lib/mobile-ui";

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
  const [layoutFilter, setLayoutFilter] = useState<SkinLayout | "all">("all");
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
      return (
        t.name.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s) ||
        t.tagline.toLowerCase().includes(s)
      );
    });
  }, [q, layoutFilter]);

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

  const pick = (id: SkinId) => {
    setSkin(id);
    if (mobile) setSkinOpen(false);
  };

  const layouts: Array<SkinLayout | "all"> = ["all", "side", "immersive", "compact"];

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
      {mobile ? (
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
            <div className="skin-card__name">{locale === "en" ? s.id : s.name}</div>
            {!mobile ? (
              <div className="skin-card__tag">
                {LAYOUT_META[s.layout]?.name
                  ? tr("skin.layoutPrefix", { name: tr(`layout.${s.layout}`) })
                  : ""}
                {locale === "en" ? tr(`layout.${s.layout}`) : s.tagline}
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
            style={
              mobile
                ? undefined
                : anchor
                  ? {
                      position: "fixed",
                      top: Math.min(anchor.bottom + 8, window.innerHeight - 120),
                      right: Math.max(8, window.innerWidth - anchor.right),
                      left: "auto",
                      zIndex: 2000,
                      maxHeight: "min(70vh, 520px)",
                      overflow: "auto",
                    }
                  : undefined
            }
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
            <span className="skin-switcher__label-full">{tr("skin.theme", { name: locale === "en" ? meta.id : meta.name })}</span>
            <span className="skin-switcher__label-short">{locale === "en" ? meta.id : meta.name}</span>
          </span>
        </button>
        <button
          type="button"
          className="skin-switcher__btn"
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
