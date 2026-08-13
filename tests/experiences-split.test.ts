import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { splitDict, splitT } from "../client/src/skins/experiences/split/i18n.js";
import {
  SPLIT_LAYOUT,
  SPLIT_THEME_IDS,
  SPLIT_THEMES,
  getSplitTheme,
  isSplitThemeId,
  splitDeep,
  splitDim,
  splitThemeToCssVars,
} from "../client/src/skins/experiences/split/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/split");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("split experience files", () => {
  it("ships the allowed file set", () => {
    for (const name of [
      "PLAN.md",
      "SplitLayout.tsx",
      "split.css",
      "theme.ts",
      "i18n.ts",
    ]) {
      expect(fs.existsSync(path.join(dir, name)), name).toBe(true);
    }
  });
});

describe("SplitLayout chrome", () => {
  const tsx = read("SplitLayout.tsx");

  it("exports SplitLayout({ brand }: { brand: string })", () => {
    expect(tsx).toMatch(
      /export function SplitLayout\(\{\s*brand\s*\}:\s*\{\s*brand:\s*string\s*\}\)/
    );
  });

  it("does not use SkinHead or TabNav", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
  });

  it("reuses player, list, search, switchers, and usePlayer", () => {
    expect(tsx).toMatch(/from ["'].*Transport["']/);
    expect(tsx).toMatch(/from ["'].*CoverImg["']/);
    expect(tsx).toMatch(/from ["'].*TrackList["']/);
    expect(tsx).toMatch(/from ["'].*ChartsPanel["']/);
    expect(tsx).toMatch(/from ["'].*LyricsView["']/);
    expect(tsx).toMatch(/from ["'].*SearchBar["']/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/from ["'].*SkinSwitcher["']/);
    expect(tsx).toMatch(/from ["'].*LocaleSwitcher["']/);
    expect(tsx).toMatch(/from ["'].*store\/player["']/);
  });

  it("keeps play/prev/next in the player column via Transport", () => {
    expect(tsx).toMatch(/<Transport\s*\/>/);
    expect(tsx).toMatch(/split-transport/);
    expect(tsx).toMatch(/split-player/);
  });

  it("reaches favorites, history, search, charts, playlist, lyrics", () => {
    for (const tab of [
      "favorites",
      "history",
      "search",
      "charts",
      "playlist",
      "lyrics",
    ]) {
      expect(tsx.includes(`"${tab}"`), tab).toBe(true);
    }
  });

  it("stays inside the hard content boundary", () => {
    expect(tsx).not.toMatch(/\b(social|video|VIP|vip)\b/);
  });
});

describe("split.css breakpoints and hits", () => {
  const css = read("split.css");

  it("declares 720px and 1024px rules", () => {
    expect(css).toMatch(/720px/);
    expect(css).toMatch(/1024px/);
  });

  it("has two-pane vs stacked rules", () => {
    expect(css).toMatch(/two-pane/);
    expect(css).toMatch(/stacked/);
    expect(css).toMatch(/grid-template-columns/);
    expect(css).toMatch(/@media \(max-width: 720px\)[\s\S]*flex-direction:\s*column/);
  });

  it("keeps controls at least 44px", () => {
    expect(css).toMatch(/44px/);
    expect(css).toMatch(/\.t-btn[\s\S]*min-width:\s*44px/);
    expect(css).toMatch(/\.t-btn[\s\S]*min-height:\s*44px/);
    expect(css).toMatch(/split-search-launch[\s\S]*min-width:\s*44px/);
    expect(css).toMatch(/split-spine__btn[\s\S]*min-height:\s*44px/);
  });

  it("uses dvh and safe-area insets", () => {
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset-top/);
    expect(css).toMatch(/safe-area-inset-bottom/);
  });
});

describe("split-dim / split-deep tokens", () => {
  it("exports both ids with layout split", () => {
    expect(SPLIT_THEME_IDS).toEqual(["split-dim", "split-deep"]);
    expect(SPLIT_LAYOUT).toBe("split");
    expect(SPLIT_THEMES.map((t) => t.id)).toEqual(["split-dim", "split-deep"]);
    for (const t of SPLIT_THEMES) {
      expect(t.layout).toBe("split");
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(t.taglineEn)).toBe(false);
    }
  });

  it("paints dim as muted dark and deep as saturated dark", () => {
    expect(splitDim.id).toBe("split-dim");
    expect(splitDeep.id).toBe("split-deep");
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(splitDim.bg)).toBeLessThan(50);
    expect(lum(splitDeep.bg)).toBeLessThan(30);
    expect(splitDim.accent).not.toBe(splitDeep.accent);
  });

  it("resolves ids and emits css vars", () => {
    expect(isSplitThemeId("split-dim")).toBe(true);
    expect(isSplitThemeId("aurora")).toBe(false);
    expect(getSplitTheme("split-deep").id).toBe("split-deep");
    expect(getSplitTheme("unknown").id).toBe("split-dim");
    const vars = splitThemeToCssVars(splitDim);
    expect(vars["--bg"]).toBe(splitDim.bg);
    expect(vars["--accent"]).toBe(splitDim.accent);
    expect(vars["--wallpaper"]).toBeTruthy();
  });
});

describe("split i18n", () => {
  it("covers zh and en with the same keys", () => {
    const zhKeys = Object.keys(splitDict.zh).sort();
    const enKeys = Object.keys(splitDict.en).sort();
    expect(zhKeys).toEqual(enKeys);
    expect(splitT("zh", "experience")).toBe("并听");
    expect(splitT("en", "experience")).toMatch(/Split/i);
    expect(/[\u4e00-\u9fff]/.test(splitDict.en.experience)).toBe(false);
  });
});
