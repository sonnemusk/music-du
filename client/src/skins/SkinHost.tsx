import type { CSSProperties } from "react";
import { getTheme, themeToCssVars, type SkinId } from "./theme-catalog";
import { CompactLayout } from "./layouts/CompactLayout";
import { DockLayout } from "./layouts/DockLayout";
import { ImmersiveLayout } from "./layouts/ImmersiveLayout";
import {
  CardLayout,
  CinematicLayout,
  ConsoleLayout,
  FocusLayout,
  GridLayout,
  LibraryLayout,
  MagazineLayout,
  MosaicLayout,
  PosterLayout,
  RailLayout,
  SheetLayout,
  StackLayout,
  StripLayout,
  TheaterLayout,
  ZenLayout,
} from "./layouts/MoreLayouts";
import { SideLayout } from "./layouts/SideLayout";
import { SplitLayout } from "./layouts/SplitLayout";
import "./layouts/layouts.css";
import "./themes/refined-base.css";

export function SkinHost({ skin }: { skin: SkinId | string }) {
  const meta = getTheme(skin);
  const brand = `Music · ${meta.name}`;
  const vars = themeToCssVars(meta) as CSSProperties;

  let layout = null;
  switch (meta.layout) {
    case "side":
      layout = <SideLayout brand={brand} />;
      break;
    case "dock":
      layout = <DockLayout brand={brand} />;
      break;
    case "immersive":
      layout = <ImmersiveLayout brand={brand} />;
      break;
    case "split":
      layout = <SplitLayout brand={brand} />;
      break;
    case "compact":
      layout = <CompactLayout brand={brand} />;
      break;
    case "stack":
      layout = <StackLayout brand={brand} />;
      break;
    case "theater":
      layout = <TheaterLayout brand={brand} />;
      break;
    case "rail":
      layout = <RailLayout brand={brand} />;
      break;
    case "magazine":
      layout = <MagazineLayout brand={brand} />;
      break;
    case "card":
      layout = <CardLayout brand={brand} />;
      break;
    case "grid":
      layout = <GridLayout brand={brand} />;
      break;
    case "strip":
      layout = <StripLayout brand={brand} />;
      break;
    case "poster":
      layout = <PosterLayout brand={brand} />;
      break;
    case "focus":
      layout = <FocusLayout brand={brand} />;
      break;
    case "library":
      layout = <LibraryLayout brand={brand} />;
      break;
    case "cinematic":
      layout = <CinematicLayout brand={brand} />;
      break;
    case "zen":
      layout = <ZenLayout brand={brand} />;
      break;
    case "console":
      layout = <ConsoleLayout brand={brand} />;
      break;
    case "sheet":
      layout = <SheetLayout brand={brand} />;
      break;
    case "mosaic":
      layout = <MosaicLayout brand={brand} />;
      break;
    default:
      layout = <SideLayout brand={brand} />;
  }

  return (
    <div
      className={`skin-host surface-${meta.surface} density-${meta.density} radius-${meta.radius}`}
      data-skin={meta.id}
      data-layout={meta.layout}
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
