import type { CSSProperties } from "react";
import { getTheme, themeToCssVars, type SkinId } from "./theme-catalog";
import { CompactLayout } from "./layouts/CompactLayout";
import { DockLayout } from "./layouts/DockLayout";
import { ImmersiveLayout } from "./layouts/ImmersiveLayout";
import { SideLayout } from "./layouts/SideLayout";
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
    case "compact":
      layout = <CompactLayout brand={brand} />;
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
