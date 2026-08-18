import type { CSSProperties, ReactNode } from "react";
import { lazy, Suspense, useEffect, useState } from "react";
import { themeDisplayName } from "../lib/types";
import { usePlayer } from "../store/player";
import { ensureThemeFonts } from "../lib/fonts";
import { getTheme, themeToCssVars, type SkinId } from "./theme-catalog";
import "./layouts/layouts.css";
import "./themes/refined-base.css";
import "./experiences/touch.css";

const BoardsLayout = lazy(() =>
  import("./experiences/boards/BoardsLayout").then((m) => ({ default: m.BoardsLayout }))
);
const DeskLayout = lazy(() =>
  import("./experiences/desk/DeskLayout").then((m) => ({ default: m.DeskLayout }))
);
const DockLayout = lazy(() =>
  import("./experiences/dock/DockLayout").then((m) => ({ default: m.DockLayout }))
);
const FeedLayout = lazy(() =>
  import("./experiences/feed/FeedLayout").then((m) => ({ default: m.FeedLayout }))
);
const FindLayout = lazy(() =>
  import("./experiences/find/FindLayout").then((m) => ({ default: m.FindLayout }))
);
const LikesLayout = lazy(() =>
  import("./experiences/likes/LikesLayout").then((m) => ({ default: m.LikesLayout }))
);
const RecentLayout = lazy(() =>
  import("./experiences/recent/RecentLayout").then((m) => ({ default: m.RecentLayout }))
);
const SplitLayout = lazy(() =>
  import("./experiences/split/SplitLayout").then((m) => ({ default: m.SplitLayout }))
);
const StageLayout = lazy(() =>
  import("./experiences/stage/StageLayout").then((m) => ({ default: m.StageLayout }))
);
const VerseLayout = lazy(() =>
  import("./experiences/verse/VerseLayout").then((m) => ({ default: m.VerseLayout }))
);
const CompactLayout = lazy(() =>
  import("./layouts/CompactLayout").then((m) => ({ default: m.CompactLayout }))
);
const GalleryLayout = lazy(() =>
  import("./layouts/GalleryLayout").then((m) => ({ default: m.GalleryLayout }))
);
const ImmersiveLayout = lazy(() =>
  import("./layouts/ImmersiveLayout").then((m) => ({ default: m.ImmersiveLayout }))
);
const SideLayout = lazy(() =>
  import("./layouts/SideLayout").then((m) => ({ default: m.SideLayout }))
);

function layoutFor(id: string, brand: string) {
  switch (id) {
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
}

function SkinHostFrame({
  className,
  dataSkin,
  dataLayout,
  style,
  children,
}: {
  className: string;
  dataSkin: string;
  dataLayout: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  const idle = usePlayer((s) => !s.curTrack);
  const tab = usePlayer((s) => s.tab);
  return (
    <div
      className={className}
      data-skin={dataSkin}
      data-layout={dataLayout}
      data-idle={idle ? "1" : undefined}
      data-tab={tab}
      style={style}
    >
      {children}
    </div>
  );
}

export function SkinHost({ skin }: { skin: SkinId | string }) {
  const meta = getTheme(skin);
  const locale = usePlayer((s) => s.locale);
  const brand = `Music · ${themeDisplayName(meta, locale)}`;
  const tokens = themeToCssVars(meta);
  const vars = tokens as CSSProperties;
  const [displayFont, setDisplayFont] = useState(() => String(tokens["--font"] || ""));

  useEffect(() => {
    const applied = themeToCssVars(meta);
    const nextDisplay = applied["--display-font"] || applied["--font"] || "";
    const fallback = applied["--font"] || nextDisplay;
    setDisplayFont((prev) => prev || fallback);
    let cancelled = false;
    void ensureThemeFonts(meta.font, meta.displayFont, meta.monoFont).then(() => {
      if (!cancelled) setDisplayFont(nextDisplay);
    });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  // Portalled surfaces (theme panel, mobile search layer) hang off <body> and
  // would otherwise miss the tokens set on .skin-host — mirror them on :root.
  useEffect(() => {
    const root = document.documentElement;
    const applied = themeToCssVars(meta);
    for (const [k, v] of Object.entries(applied)) {
      if (k === "--display-font") continue;
      root.style.setProperty(k, v);
    }
    if (displayFont) root.style.setProperty("--display-font", displayFont);
    return () => {
      for (const k of Object.keys(applied)) root.style.removeProperty(k);
    };
  }, [meta, displayFont]);

  return (
    <SkinHostFrame
      className={`skin-host surface-${meta.surface} density-${meta.density} radius-${meta.radius}`}
      dataSkin={meta.id}
      dataLayout={meta.layout}
      style={{
        ...vars,
        ["--display-font" as string]: displayFont || tokens["--font"],
        background: "var(--wallpaper)",
        color: "var(--fg)",
        fontFamily: "var(--font)",
      }}
    >
      <Suspense
        fallback={
          <div className="skin-layout-fallback" aria-busy="true">
            <span className="skin-layout-fallback__mark">Music</span>
          </div>
        }
      >
        {layoutFor(meta.layout, brand)}
      </Suspense>
    </SkinHostFrame>
  );
}
