import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../i18n";
import { labelForLevel, qualityShortLabel } from "../lib/quality";
import { usePlayer } from "../store/player";

/**
 * Quality control: button shows current short label; click opens menu.
 * Menu = this track's real top-3 levels (with pre-cached URLs for instant switch).
 */
export function QualityPicker({ className }: { className?: string }) {
  const quality = usePlayer((s) => s.quality);
  const preferredQuality = usePlayer((s) => s.preferredQuality);
  const availableQualities = usePlayer((s) => s.availableQualities);
  const setQualityLevel = usePlayer((s) => s.setQualityLevel);
  const ensureQualities = usePlayer((s) => s.ensureQualities);
  const curTrack = usePlayer((s) => s.curTrack);
  const locale = usePlayer((s) => s.locale);
  const tr = useT(locale);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    placed: boolean;
  } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /**
   * The menu is portalled to <body>: inside the transport it was trapped in
   * .transport-row's stacking context (z-index 2), so the seek row — which jumps
   * to z-index 30 on hover — painted over it and swallowed the clicks.
   * Prefer opening upward, since every layout puts seek/volume under this button.
   */
  const place = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const width = Math.min(288, Math.max(176, window.innerWidth * 0.8));
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
    const h = menuRef.current?.offsetHeight ?? 0;
    const room = { above: r.top - 8, below: window.innerHeight - r.bottom - 8 };
    const up = h === 0 ? true : room.above >= h || room.above > room.below;
    const top = up
      ? Math.max(8, r.top - h - 6)
      : Math.min(r.bottom + 6, Math.max(8, window.innerHeight - h - 8));
    setMenuPos({ top, left, width, placed: h > 0 });
  }, []);

  // Measure once mounted, then re-anchor whenever the content height changes
  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place, availableQualities.length, loading]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => place();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, place]);

  const currentLevel =
    quality && quality !== "…" ? quality : preferredQuality || "";
  const short = qualityShortLabel(currentLevel) || tr("quality.button");
  const full = labelForLevel(currentLevel, locale).label;
  const probing = Boolean(curTrack) && open && (loading || availableQualities.length === 0);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el || !(e.target instanceof Node)) return;
      // The menu lives in a portal, so it is not inside wrapRef — without this
      // check mousedown on an option would close the menu before its click.
      if (el.contains(e.target) || menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setLoading(false);
  }, [curTrack?.id]);

  // Probe only when user opens the menu (not on every playTrack)
  useEffect(() => {
    if (!open || !curTrack) return;
    if (availableQualities.length >= 1) return;
    let cancelled = false;
    setLoading(true);
    void ensureQualities().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, curTrack?.id, availableQualities.length, ensureQualities]);

  const pick = (level: string) => {
    setOpen(false);
    if (level && level !== currentLevel) setQualityLevel(level);
  };

  return (
    <div
      className={`quality-wrap${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}
      ref={wrapRef}
    >
      <button
        type="button"
        className="t-btn ghost mode quality-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tr("quality.aria", { name: full })}
        title={
          availableQualities.length
            ? tr("quality.ariaReady", { name: full, n: availableQualities.length })
            : tr("quality.aria", { name: full })
        }
        onClick={() => {
          setOpen((v) => {
            if (v) return false;
            setMenuPos(null);
            return true;
          });
        }}
      >
        {short}
      </button>
      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="quality-menu quality-menu--fixed"
              role="listbox"
              aria-label={tr("quality.menuAria")}
              style={{
                position: "fixed",
                top: menuPos?.top ?? 0,
                left: menuPos?.left ?? 0,
                width: menuPos?.width,
                right: "auto",
                // The base rule anchors upward with bottom: calc(100% + 8px).
                // Leaving it set alongside top over-constrains a fixed box, which
                // collapsed the menu to padding height (the 14px sliver).
                bottom: "auto",
                transform: "none",
                zIndex: 1200,
                // hidden for the frame before the height is known, so it never
                // flashes at the wrong anchor
                visibility: menuPos?.placed ? "visible" : "hidden",
              }}
            >
          {availableQualities.length > 0 ? (
            availableQualities.map((opt) => {
              const active = opt.level === currentLevel;
              const ready = Boolean(opt.url);
              const lab = labelForLevel(opt.level, locale);
              return (
                <button
                  key={opt.level}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? "quality-opt is-active" : "quality-opt"}
                  onClick={() => pick(opt.level)}
                >
                  <span className="quality-opt__name">{lab.label || opt.label}</span>
                  <span className="quality-opt__id">
                    {opt.br > 0
                      ? `${Math.round(opt.br / 1000)}k`
                      : ready
                        ? tr("quality.ready")
                        : ""}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="quality-opt--hint">
              <p className="quality-opt--hint-line">
                {probing ? tr("quality.probing") : tr("quality.needPlay")}
              </p>
              <p className="quality-opt--hint-sub">{tr("quality.hint")}</p>
            </div>
          )}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
