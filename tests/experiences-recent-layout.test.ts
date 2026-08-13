import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  RECENT_THEME_IDS,
  RECENT_THEMES,
  recentThemeToCssVars,
} from "../client/src/skins/experiences/recent/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/recent");
const css = fs.readFileSync(path.join(dir, "recent.css"), "utf8");
const tsx = fs.readFileSync(path.join(dir, "RecentLayout.tsx"), "utf8");

function mediaBlock(maxWidth: string): string {
  const start = css.search(
    new RegExp(`@media \\(max-width:\\s*${maxWidth}\\)\\s*\\{`)
  );
  if (start < 0) return "";
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return "";
}

describe("recent layout contract", () => {
  it("is history-first and does not use SkinHead", () => {
    expect(tsx).toMatch(/setTab\("history"\)/);
    expect(tsx).toMatch(/mode="history"/);
    expect(tsx).toMatch(/className="track-list rec-tape"/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
  });

  it("reserves a spine gutter so dots cannot cover TrackList covers or acts", () => {
    expect(css).toMatch(/--rec-spine:\s*40px/);
    expect(css).toMatch(/padding:[^;]*calc\(10px \+ var\(--rec-spine\)\)/);
    expect(css).toMatch(/\.track-row::before[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.track-list::before[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.track-row:first-child::after[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.track-acts[\s\S]*?z-index:\s*2/);
    expect(css).toMatch(/content-visibility:\s*visible/);
  });

  it("unifies mini prev/play/next at 44×44 on both viewports", () => {
    expect(css).toMatch(/--rec-btn:\s*44px/);
    expect(css).toMatch(
      /\.rec-mini\.player-bar \.player-bar__controls \.t-btn:not\(\.ghost\)/
    );
    expect(css).toMatch(/\.rec-mini\.player-bar \.player-bar__controls \.t-btn\.play/);
    const phone = mediaBlock("720px");
    expect(phone.length).toBeGreaterThan(200);
    expect(phone).toMatch(/min-width:\s*44px/);
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(phone).not.toMatch(/\.t-btn\.play[^{]*\{[^}]*width:\s*4[68]px/);
    expect(phone).toMatch(/align-items:\s*center/);
  });

  it("beats shared player-bar grid so the mini bar stays 3 columns", () => {
    expect(css).toMatch(
      /grid-template-columns:\s*auto minmax\(0,\s*1fr\) minmax\(200px,\s*1\.2fr\)/
    );
    const phone = mediaBlock("720px");
    expect(phone).toMatch(/grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    expect(phone).toMatch(/width:\s*auto/);
    expect(phone).toMatch(/left:\s*max\(8px,\s*env\(safe-area-inset-left/);
    expect(phone).toMatch(/bottom:\s*calc\(var\(--rec-nav\) \+ env\(safe-area-inset-bottom/);
  });

  it("aligns rail destinations and keeps the phone bar from overflowing", () => {
    expect(css).toMatch(/\.rec-rail__item[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.rec-rail__item[\s\S]*?align-items:\s*center/);
    const phone = mediaBlock("720px");
    expect(phone).toMatch(/flex-direction:\s*row/);
    expect(phone).toMatch(/overflow-x:\s*hidden/);
    expect(phone).toMatch(/flex:\s*1 1 0/);
    expect(phone).toMatch(/min-width:\s*0/);
  });

  it("makes the search overlay and launch ≥44px on the 720px phone", () => {
    expect(css).toMatch(/\.rec-search-launch[\s\S]*?min-width:\s*44px/);
    const phone = mediaBlock("720px");
    expect(phone).toMatch(/--search-overlay-bottom/);
    expect(phone).toMatch(/\.search-overlay__input/);
    expect(phone).toMatch(/\.search-overlay__go/);
    expect(phone).toMatch(/min-height:\s*44px/);
  });

  it("clamps overflow from 390 to 1280 and keeps dvh / safe-area", () => {
    expect(css).toMatch(/max-width:\s*100%/);
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(css).toMatch(/safe-area-inset-left/);
    expect(css).toMatch(/@media \(max-width:\s*1279px\)/);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
  });

  it("keeps both palettes and --radius on css vars", () => {
    expect(RECENT_THEME_IDS).toEqual(["recent-dim", "recent-deep"]);
    for (const t of RECENT_THEMES) {
      const vars = recentThemeToCssVars(t);
      expect(vars["--radius"]).toBeTruthy();
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
    }
  });
});
