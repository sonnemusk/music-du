import { useEffect, useRef, useState } from "react";
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
  const curTrack = usePlayer((s) => s.curTrack);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const currentLevel =
    quality && quality !== "…" ? quality : preferredQuality || "";
  const short = qualityShortLabel(currentLevel) || "音质";
  const full = labelForLevel(currentLevel).label;
  const probing = Boolean(curTrack) && availableQualities.length === 0;

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
  }, [curTrack?.id]);

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
        aria-label={`音质：${full}`}
        title={
          availableQualities.length
            ? `音质：${full}（已预解析 ${availableQualities.length} 档，点击切换）`
            : `音质：${full}`
        }
        onClick={() => setOpen((v) => !v)}
      >
        {short}
      </button>
      {open ? (
        <div className="quality-menu" role="listbox" aria-label="选择音质">
          {availableQualities.length > 0 ? (
            availableQualities.map((opt) => {
              const active = opt.level === currentLevel;
              const ready = Boolean(opt.url);
              return (
                <button
                  key={opt.level}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={active ? "quality-opt is-active" : "quality-opt"}
                  onClick={() => pick(opt.level)}
                >
                  <span className="quality-opt__name">{opt.label}</span>
                  <span className="quality-opt__id">
                    {opt.br > 0 ? `${Math.round(opt.br / 1000)}k` : ready ? "就绪" : ""}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="quality-opt--hint">
              <p className="quality-opt--hint-line">
                {probing ? "正在探测本曲可用音质…" : "先播放一首歌后再选音质"}
              </p>
              <p className="quality-opt--hint-sub">默认第二档（如沉浸）</p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
