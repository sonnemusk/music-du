import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STAGE_LAYOUT,
  STAGE_THEME_IDS,
  getStageTheme,
  stageThemeToCssVars,
} from "../client/src/skins/experiences/stage/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/stage");
const tsx = fs.readFileSync(path.join(dir, "StageLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(dir, "stage.css"), "utf8");

describe("stage experience", () => {
  it("ships the isolated file set", () => {
    for (const f of ["PLAN.md", "StageLayout.tsx", "stage.css", "theme.ts", "i18n.ts"]) {
      expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
    }
  });

  it("does not use SkinHead or TabNav chrome", () => {
    expect(tsx).toMatch(/export function StageLayout\(\{ brand \}/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/CompactLayout|ImmersiveLayout|SideLayout|GalleryLayout/);
  });

  it("reuses player surfaces and mobile search gesture", () => {
    expect(tsx).toMatch(/usePlayer/);
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/CoverImg/);
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/max-width: 720px/);
  });

  it("search path exists: desktop wing SearchBar, phone overlay", () => {
    expect(tsx).toMatch(/tab === "search" && !narrow \? <SearchBar/);
    expect(tsx).toMatch(/id === "search" && narrow/);
    expect(tsx).toMatch(/openMobileSearchFromGesture\(\)/);
    expect(tsx).toMatch(/className="stage-search"/);
    expect(tsx).toMatch(/data-stage-search/);
    expect(tsx).toMatch(/--search-overlay-bottom/);
    expect(css).toMatch(/\.stage-search/);
  });

  it("CSS splits at 720px+ (wing vs pit)", () => {
    expect(css.includes("720px"), "720px").toBe(true);
    expect(css).toMatch(/min-width:\s*721px/);
    expect(css).toMatch(/max-width:\s*720px/);
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toMatch(/max-height:\s*100%/);
    expect(css).toMatch(/--stage-art:[\s\S]*dvh/);
    expect(css).toMatch(/safe-area-inset/);
  });

  it("stage-dim and stage-deep have different backgrounds", () => {
    expect(STAGE_THEME_IDS).toEqual(["stage-dim", "stage-deep"]);
    const dim = getStageTheme("stage-dim");
    const deep = getStageTheme("stage-deep");
    expect(dim.layout).toBe(STAGE_LAYOUT);
    expect(deep.layout).toBe("stage");
    expect(dim.bg).toMatch(/^#|^rgb|oklch|hsl/);
    expect(deep.bg).toMatch(/^#|^rgb|oklch|hsl/);
    expect(dim.bg).not.toBe(deep.bg);
    expect(stageThemeToCssVars(dim)["--bg"]).not.toBe(stageThemeToCssVars(deep)["--bg"]);
    expect(stageThemeToCssVars(dim)["--bg"]).toBe(dim.bg);
  });

  it("play button is at least 44px", () => {
    expect(css).toMatch(/\.layout-stage\s+\.t-btn\.play[\s\S]{0,400}min-width:\s*44px/);
    expect(css).toMatch(/\.layout-stage\s+\.t-btn\.play[\s\S]{0,400}min-height:\s*44px/);
  });
});
