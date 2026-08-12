import { useEffect, useRef, useState } from "react";
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
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentLevel =
    quality && quality !== "…" ? quality : preferredQuality || "";
  const short = qualityShortLabel(currentLevel) || tr("quality.button");
  const full = labelForLevel(currentLevel, locale).label;
  const probing = Boolean(curTrack) && open && (loading || availableQualities.length === 0);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
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
            const next = !v;
            if (next && wrapRef.current) {
              const r = wrapRef.current.getBoundingClientRect();
              const w = Math.min(288, window.innerWidth * 0.8);
              let left = r.left + r.width / 2 - w / 2;
              left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
              setMenuPos({ top: r.bottom + 6, left });
            }
            return next;
          });
        }}
      >
        {short}
      </button>
      {open ? (
        <div
          className="quality-menu quality-menu--fixed"
          role="listbox"
          aria-label={tr("quality.menuAria")}
          style={
            menuPos
              ? { position: "fixed", top: menuPos.top, left: menuPos.left, right: "auto", transform: "none", zIndex: 1200 }
              : undefined
          }
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
        </div>
      ) : null}
    </div>
  );
}
