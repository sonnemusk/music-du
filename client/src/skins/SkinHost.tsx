import type { CSSProperties } from "react";
import { useEffect } from "react";
import { usePlayer } from "../store/player";
import { getTheme, themeToCssVars, type SkinId } from "./theme-catalog";
import { CompactLayout } from "./layouts/CompactLayout";
import { GalleryLayout } from "./layouts/GalleryLayout";
import { ImmersiveLayout } from "./layouts/ImmersiveLayout";
import { SideLayout } from "./layouts/SideLayout";
import "./layouts/layouts.css";
import "./themes/refined-base.css";

const FONT_LINKS: Record<string, string> = {
  "Bebas Neue": "Bebas+Neue",
  "DM Sans": "DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,800",
  "IBM Plex Mono": "IBM+Plex+Mono:wght@400;600",
  "Instrument Serif": "Instrument+Serif:ital@0;1",
  "JetBrains Mono": "JetBrains+Mono:wght@400;600",
  Outfit: "Outfit:wght@400;600;800",
  "Playfair Display": "Playfair+Display:wght@600;700",
  "Space Grotesk": "Space+Grotesk:wght@500;700",
  Syne: "Syne:wght@600;700;800",
};

function ensureThemeFont(fontFamily: string | undefined) {
  if (!fontFamily || typeof document === "undefined") return;
  const name = fontFamily.split(",")[0]?.replace(/["']/g, "").trim();
  if (!name || name === "system-ui" || name.includes("PingFang")) return;
  const id = `font-${name.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const q = FONT_LINKS[name];
  if (!q) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${q}&display=swap`;
  link.media = "print";
  link.onload = () => {
    link.media = "all";
  };
  document.head.appendChild(link);
}

export function SkinHost({ skin }: { skin: SkinId | string }) {
  const meta = getTheme(skin);
  const brand = `Music · ${meta.name}`;
  const vars = themeToCssVars(meta) as CSSProperties;
  const curTrack = usePlayer((s) => s.curTrack);
  const tab = usePlayer((s) => s.tab);
  const idle = !curTrack;

  useEffect(() => {
    ensureThemeFont(meta.font);
    ensureThemeFont(meta.displayFont);
    ensureThemeFont(meta.monoFont);
  }, [meta.font, meta.displayFont, meta.monoFont]);

  // Portalled surfaces (theme panel, mobile search layer) hang off <body> and
  // would otherwise miss the tokens set on .skin-host — mirror them on :root.
  useEffect(() => {
    const root = document.documentElement;
    const applied = themeToCssVars(meta);
    for (const [k, v] of Object.entries(applied)) root.style.setProperty(k, v);
    return () => {
      for (const k of Object.keys(applied)) root.style.removeProperty(k);
    };
  }, [meta]);

  const layout = (() => {
    switch (meta.layout) {
      case "immersive":
        return <ImmersiveLayout brand={brand} />;
      case "compact":
        return <CompactLayout brand={brand} />;
      case "gallery":
        return <GalleryLayout brand={brand} />;
      case "side":
      default:
        return <SideLayout brand={brand} />;
    }
  })();

  return (
    <div
      className={`skin-host surface-${meta.surface} density-${meta.density} radius-${meta.radius}`}
      data-skin={meta.id}
      data-layout={meta.layout}
      data-idle={idle ? "1" : undefined}
      data-tab={tab}
      style={{
        ...vars,
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      {layout}
    </div>
  );
}
