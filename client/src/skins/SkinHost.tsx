import type { CSSProperties } from "react";
import { useEffect } from "react";
import { themeDisplayName } from "../lib/types";
import { usePlayer } from "../store/player";
import { ensureThemeFonts } from "../lib/fonts";
import { getTheme, themeToCssVars, type SkinId } from "./theme-catalog";
import { BoardsLayout } from "./experiences/boards/BoardsLayout";
import { DeskLayout } from "./experiences/desk/DeskLayout";
import { DockLayout } from "./experiences/dock/DockLayout";
import { FeedLayout } from "./experiences/feed/FeedLayout";
import { FindLayout } from "./experiences/find/FindLayout";
import { LikesLayout } from "./experiences/likes/LikesLayout";
import { RecentLayout } from "./experiences/recent/RecentLayout";
import { SplitLayout } from "./experiences/split/SplitLayout";
import { StageLayout } from "./experiences/stage/StageLayout";
import { VerseLayout } from "./experiences/verse/VerseLayout";
import { CompactLayout } from "./layouts/CompactLayout";
import { GalleryLayout } from "./layouts/GalleryLayout";
import { ImmersiveLayout } from "./layouts/ImmersiveLayout";
import { SideLayout } from "./layouts/SideLayout";
import "./layouts/layouts.css";
import "./themes/refined-base.css";
import "./experiences/touch.css";

export function SkinHost({ skin }: { skin: SkinId | string }) {
  const meta = getTheme(skin);
  const locale = usePlayer((s) => s.locale);
  const brand = `Music · ${themeDisplayName(meta, locale)}`;
  const vars = themeToCssVars(meta) as CSSProperties;
  const curTrack = usePlayer((s) => s.curTrack);
  const tab = usePlayer((s) => s.tab);
  const idle = !curTrack;

  useEffect(() => {
    ensureThemeFonts(meta.font, meta.displayFont, meta.monoFont);
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
      case "dock":
        return <DockLayout brand={brand} />;
      case "desk":
        return <DeskLayout brand={brand} />;
      case "feed":
        return <FeedLayout brand={brand} />;
      case "stage":
        return <StageLayout brand={brand} />;
      case "verse":
        return <VerseLayout brand={brand} />;
      case "likes":
        return <LikesLayout brand={brand} />;
      case "recent":
        return <RecentLayout brand={brand} />;
      case "find":
        return <FindLayout brand={brand} />;
      case "boards":
        return <BoardsLayout brand={brand} />;
      case "split":
        return <SplitLayout brand={brand} />;
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
