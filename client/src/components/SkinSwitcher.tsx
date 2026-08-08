import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SKINS, type SkinId } from "../lib/types";
import { LAYOUT_META } from "../skins/layouts/layout-ids";
import { usePlayer } from "../store/player";

/**
 * Theme switcher — sits in .skin-head__tools (same bar as search).
 * Dropdown is portaled to document.body so layout overflow never clips it.
 */
export function SkinSwitcher() {
  const skin = usePlayer((s) => s.skin);
  const open = usePlayer((s) => s.skinOpen);
  const setSkin = usePlayer((s) => s.setSkin);
  const cycleSkin = usePlayer((s) => s.cycleSkin);
  const setSkinOpen = usePlayer((s) => s.setSkinOpen);
  const meta = SKINS.find((x) => x.id === skin) || SKINS[0];
  const [q, setQ] = useState("");
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return SKINS;
    return SKINS.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.id.toLowerCase().includes(s) ||
        t.tagline.toLowerCase().includes(s)
    );
  }, [q]);

  const layoutCount = useMemo(
    () => new Set(SKINS.map((t) => t.layout)).size,
    []
  );

  // Measure button group for portal panel position
  useEffect(() => {
    if (!open) {
      setAnchor(null);
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
  }, [open]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="skin-panel skin-panel--portal"
            role="dialog"
            aria-label="切换主题"
            // Stop outside-close handlers from treating panel clicks as "outside"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={
              anchor
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
            <div className="skin-panel__hint">
              共 {SKINS.length} 套 · {layoutCount} 种布局 · 点选切换
            </div>
            <input
              className="skin-panel__search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="筛选主题名…"
              autoComplete="off"
              onMouseDown={(e) => e.stopPropagation()}
            />
            <div className="skin-panel__grid">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`skin-card ${skin === s.id ? "active" : ""}`}
                  style={{ ["--skin-accent" as string]: s.accent }}
                  onMouseDown={(e) => {
                    // Apply on mousedown so theme switches even if panel unmounts before click
                    e.preventDefault();
                    e.stopPropagation();
                    setSkin(s.id as SkinId);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSkin(s.id as SkinId);
                  }}
                >
                  <div className="skin-card__swatch" style={{ background: s.accent }} />
                  <div className="skin-card__name">{s.name}</div>
                  <div className="skin-card__tag">
                    {LAYOUT_META[s.layout]?.name
                      ? `布局·${LAYOUT_META[s.layout].name} · `
                      : ""}
                    {s.tagline}
                  </div>
                </button>
              ))}
            </div>
            {!filtered.length && <div className="skin-panel__empty">没有匹配主题</div>}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="skin-switcher" style={{ ["--skin-accent" as string]: meta.accent }}>
      <div className="skin-switcher__bar">
        <button
          type="button"
          className={`skin-switcher__btn ${open ? "on" : ""}`}
          title="打开主题列表"
          onClick={() => setSkinOpen(!open)}
        >
          <span className="skin-switcher__dot" style={{ background: meta.accent }} />
          <span className="skin-switcher__label">
            <span className="skin-switcher__label-full">主题 · {meta.name}</span>
            <span className="skin-switcher__label-short">{meta.name}</span>
          </span>
        </button>
        <button
          type="button"
          className="skin-switcher__btn primary"
          title="一键切换下一主题"
          onClick={cycleSkin}
        >
          <span className="skin-switcher__label-full">一键切换</span>
          <span className="skin-switcher__label-short">切换</span>
        </button>
      </div>
      {panel}
    </div>
  );
}
