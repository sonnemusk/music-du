import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIND_LAYOUT, FIND_THEMES, findThemeToCssVars } from "../client/src/skins/experiences/find/theme.js";
import { findText } from "../client/src/skins/experiences/find/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/find");

const read = (name: string) => fs.readFileSync(path.join(dir, name), "utf8");

describe("find experience", () => {
  const tsx = read("FindLayout.tsx");
  const css = read("find.css");
  const themeSrc = read("theme.ts");
  const i18nSrc = read("i18n.ts");

  it("ships the required files only", () => {
    for (const name of ["PLAN.md", "FindLayout.tsx", "find.css", "theme.ts", "i18n.ts"]) {
      expect(fs.existsSync(path.join(dir, name)), name).toBe(true);
    }
  });

  it("exports FindLayout({ brand }) and does not use shared chrome", () => {
    expect(tsx).toMatch(/export function FindLayout\(\{\s*brand\s*\}/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/from ["'].*layouts\//);
  });

  it("is search-first: SearchBar + setTab search on mount", () => {
    expect(tsx).toMatch(/<SearchBar\b/);
    expect(tsx).toMatch(/className="find-search/);
    expect(tsx).toMatch(/setTab\("search"\)/);
    expect(tsx).toMatch(/mode="search"/);
    expect(tsx).toMatch(/usePlayer/);
    expect(tsx).not.toMatch(/SkinHead/);
  });

  it("reuses player, search, library, charts, lyrics, locale, theme", () => {
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/CoverImg/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).not.toMatch(/comment|social|VIP|recommend/i);
  });

  it("defines find-dim and find-deep with layout find", () => {
    expect(themeSrc).toMatch(/find-dim/);
    expect(themeSrc).toMatch(/find-deep/);
    expect(FIND_LAYOUT).toBe("find");
    const ids = FIND_THEMES.map((t) => t.id);
    expect(ids).toEqual(["find-dim", "find-deep"]);
    for (const t of FIND_THEMES) {
      expect(t.layout).toBe("find");
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(t.taglineEn)).toBe(false);
      const vars = findThemeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
    }
  });

  it("CSS covers 720px+, 16px input, 44px targets, dvh and safe-area", () => {
    expect(css).toMatch(/720px/);
    expect(css).toMatch(/min-width:\s*721px/);
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/min-width:\s*44px/);
    expect(css).toMatch(/height:\s*100%|max-height:\s*100%/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/overflow:\s*hidden/);
  });

  it("keeps overlay available and shows SearchBar on phone", () => {
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/className="find-search/);
    expect(css).toMatch(/\.layout-find \.find-search input/);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*font-size:\s*16px/);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*\.find-search[\s\S]*display:\s*flex/);
    expect(css).not.toMatch(/@media \(max-width: 720px\)[\s\S]*\.find-search[^{]*\{[^}]*display:\s*none/);
  });

  it("local i18n covers zh and en without touching app dicts", () => {
    expect(i18nSrc).toMatch(/zh:/);
    expect(i18nSrc).toMatch(/en:/);
    expect(findText("zh", "mark")).toBe("检索");
    expect(findText("en", "mark")).toBe("Find");
    expect(findText("en", "queueHint", { n: 3 })).toContain("3");
    expect(findText("zh", "drawers")).toMatch(/搜不到/);
  });
});
