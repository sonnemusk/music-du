import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STAGE_THEME_IDS,
  getStageTheme,
  stageThemeToCssVars,
} from "../client/src/skins/experiences/stage/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/stage");
const tsx = fs.readFileSync(path.join(dir, "StageLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(dir, "stage.css"), "utf8");

function px(value: string | undefined): number {
  if (!value) return NaN;
  const m = value.replace(/!important/g, "").trim().match(/^(-?[\d.]+)px$/);
  return m ? Number(m[1]) : NaN;
}

/** First `{...}` block after `selector` (nested-unaware; stage.css is flat). */
function block(src: string, selector: string): string {
  const idx = src.indexOf(selector);
  if (idx < 0) return "";
  const open = src.indexOf("{", idx);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return "";
}

function decl(body: string, prop: string): string | undefined {
  const re = new RegExp(`(?:^|;|\\n)\\s*${prop}\\s*:\\s*([^;]+);`);
  return body.match(re)?.[1]?.trim();
}

function minPx(body: string, ...props: string[]): number {
  const vals = props.map((p) => px(decl(body, p))).filter((n) => Number.isFinite(n));
  return vals.length ? Math.min(...vals) : NaN;
}

describe("stage e2e layout polish", () => {
  it("footlight trio is large and ≥44 (ghost rules cannot shrink play)", () => {
    const play = block(css, ".layout-stage .t-btn.play");
    const skip = block(css, ".layout-stage .t-btn:not(.ghost)");
    const ghost = block(css, ".layout-stage .t-btn.ghost");

    expect(minPx(play, "min-width", "min-height")).toBeGreaterThanOrEqual(44);
    expect(minPx(play, "width", "height")).toBeGreaterThanOrEqual(44);
    expect(px(decl(play, "width"))).toBe(88);
    expect(px(decl(play, "height"))).toBe(88);

    expect(minPx(skip, "min-width", "min-height")).toBeGreaterThanOrEqual(44);
    expect(px(decl(skip, "width"))).toBe(64);
    expect(px(decl(skip, "height"))).toBe(64);

    expect(ghost).toMatch(/min-width:\s*44px\s*!important/);
    expect(ghost).toMatch(/min-height:\s*44px\s*!important/);
    expect(css).toMatch(/\.t-btn:not\(\.ghost\)/);
    expect(css).toMatch(/pointer:\s*coarse/);
    expect(skip).toMatch(/!important/);
    expect(play).toMatch(/!important/);
  });

  it("cue rail is one 6-up grid, 44px tall, tight at 390", () => {
    const wings = block(css, ".stage-wings");
    const cue = block(css, ".stage-cue");
    expect(decl(wings, "display")).toBe("grid");
    expect(decl(wings, "grid-template-columns")).toMatch(/repeat\(\s*6/);
    expect(minPx(cue, "min-height", "height")).toBe(44);

    const phone = css.split("@media (max-width: 390px)")[1] || "";
    expect(phone).toMatch(/\.stage-cue/);
    expect(phone).toMatch(/font-size:\s*11px/);

    const pad = 24;
    const gap = 4 * 5;
    const cell = (390 - pad - gap) / 6;
    expect(cell).toBeGreaterThanOrEqual(44);
  });

  it("now-playing title stays inside the art column when the window is short", () => {
    expect(css).toMatch(/--stage-art:/);
    const now = block(css, ".layout-stage .stage-now.now-playing");
    expect(now).toMatch(/container-type:\s*size/);
    expect(now).toMatch(/gap:\s*0/);
    expect(now).not.toMatch(/width:\s*var\(--stage-art\)/);
    expect(now).toMatch(/--stage-meta:/);
    expect(css).toMatch(/100cqh - var\(--stage-meta\)/);
    const proc = block(css, "\n.stage-proscenium");
    expect(proc).toMatch(/aspect-ratio:\s*1/);
    expect(proc).toMatch(/flex:\s*0 0 auto/);
    const title = block(css, ".layout-stage .stage-now .stage-title") || block(css, ".stage-title");
    expect(title).toMatch(/max-height:\s*2\.4em/);
    expect(title).not.toMatch(/white-space:\s*nowrap/);
    expect(title).not.toMatch(/520px/);
  });

  it("sheet close is 44 and pit does not sit on the footlights", () => {
    const close = block(css, ".stage-sheet__close");
    expect(px(decl(close, "min-width"))).toBeGreaterThanOrEqual(44);
    expect(px(decl(close, "min-height"))).toBeGreaterThanOrEqual(44);
    expect(css).toMatch(/--stage-reserve/);
    expect(css).toMatch(/bottom:\s*var\(--stage-reserve/);
    expect(tsx).toMatch(/--stage-reserve/);
    expect(tsx).toMatch(/--search-overlay-bottom/);
  });

  it("z-index stays below search overlay 900 and theme 2000", () => {
    expect(css).toMatch(/--stage-sheet-z:\s*80/);
    const n = Number(decl(block(css, ".layout-stage"), "--stage-sheet-z"));
    expect(n).toBe(80);
    expect(n).toBeLessThan(900);
    expect(n).toBeLessThan(2000);
    expect(css).not.toMatch(/z-index:\s*(9\d{2,}|[1-9]\d{3,})/);
  });

  it("named widths 390 / 720 / 1024 / 1280 keep overflow hidden", () => {
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/max-width:\s*390px/);
    expect(css).toMatch(/max-width:\s*720px/);
    expect(css).toMatch(/min-width:\s*1024px/);
    expect(css).toMatch(/min-width:\s*1280px/);
    expect(block(css, ".layout-stage")).toMatch(/overflow:\s*hidden/);
  });

  it("dim / deep toggle lives in the tools rail, not SkinHead", () => {
    expect(tsx).toMatch(/stage-lights/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(css).toMatch(/\.stage-tools/);
    expect(css).toMatch(/stage-light--cycle/);
    expect(css).toMatch(/\.stage-light:not\(\.stage-light--cycle\)/);
  });

  it("paints dim/deep from the shared player skin so the catalog picker applies", () => {
    expect(tsx).toMatch(/usePlayer\(\(s\) => s\.skin\)/);
    expect(tsx).toMatch(/usePlayer\(\(s\) => s\.setSkin\)/);
    expect(tsx).toMatch(/setSkin\(id\)/);
    expect(tsx).toMatch(/setSkin\("stage-dim"\)|pickLighting\("stage-dim"\)/);
    expect(tsx).toMatch(/setSkin\("stage-deep"\)|pickLighting\("stage-deep"\)/);
    expect(tsx).not.toMatch(/STAGE_THEME_KEY|kazam\.v2\.stageTheme/);
    expect(tsx).not.toMatch(/setThemeId/);
  });

  it("both palettes stay distinct after css-var mapping", () => {
    expect(STAGE_THEME_IDS).toEqual(["stage-dim", "stage-deep"]);
    const dim = stageThemeToCssVars(getStageTheme("stage-dim"));
    const deep = stageThemeToCssVars(getStageTheme("stage-deep"));
    expect(dim["--bg"]).not.toBe(deep["--bg"]);
    expect(dim["--accent"]).not.toBe(deep["--accent"]);
    expect(dim["--wallpaper"]).not.toBe(deep["--wallpaper"]);
  });
});
