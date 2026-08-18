import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  RECENT_LAYOUT,
  RECENT_THEME_IDS,
  RECENT_THEMES,
  getRecentTheme,
  isRecentThemeId,
  recentDeep,
  recentDim,
  recentThemeToCssVars,
} from "../client/src/skins/experiences/recent/theme.js";
import { recentCopy, rt } from "../client/src/skins/experiences/recent/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/recent");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("recent experience files", () => {
  it("ships the allowed file set", () => {
    for (const name of [
      "PLAN.md",
      "RecentLayout.tsx",
      "recent.css",
      "theme.ts",
      "i18n.ts",
    ]) {
      expect(fs.existsSync(path.join(dir, name)), name).toBe(true);
    }
  });
});

describe("RecentLayout", () => {
  const tsx = read("RecentLayout.tsx");

  it("exports RecentLayout and lands on history", () => {
    expect(tsx).toMatch(/export function RecentLayout\(\{\s*brand\s*\}/);
    expect(tsx).toMatch(/setTab\("history"\)/);
    expect(tsx).toMatch(/useEffect/);
  });

  it("does not use SkinHead or TabNav chrome", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/SkinChrome/);
    expect(tsx).not.toMatch(/from ["'].*layouts\/shared["']/);
  });

  it("reuses player primitives", () => {
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/mode="history"/);
    expect(tsx).toMatch(/<Transport/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/CoverImg/);
    expect(tsx).toMatch(/usePlayer/);
  });

  it("does not add out-of-bound features", () => {
    expect(tsx).not.toMatch(/comment|social|video|vip/i);
  });

  it("keeps source copy in i18n (no CJK in tsx)", () => {
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("recent.css", () => {
  const css = read("recent.css");

  it("covers desktop, tablet, and phone breakpoints", () => {
    for (const bp of ["1279px", "1023px", "720px"]) {
      expect(css.includes(bp), bp).toBe(true);
    }
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toMatch(/safe-area-inset/);
  });

  it("meets 44px touch targets", () => {
    expect(css).toMatch(/\.rec-rail__item[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.rec-search-launch[\s\S]*?min-width:\s*44px/);
    expect(css).toMatch(/\.rec-mini__art[\s\S]*?min-width:\s*44px/);
    expect(css).toMatch(/\.t-btn:not\(\.ghost\)[\s\S]*?min-width:\s*44px/);
    expect(css).toMatch(/min-height:\s*44px/);
  });

  it("styles shared TrackList as a timeline on history", () => {
    expect(css).toMatch(/\.rec-body--history\s+\.track-list/);
    expect(css).toMatch(/\.rec-body--history\s+\.track-row:first-child/);
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/--search-overlay-bottom/);
    expect(css).toMatch(/--rec-spine/);
    expect(css).toMatch(/pointer-events:\s*none/);
  });

  it("keeps mini prev/play/next equal 44px and does not enlarge play on phone", () => {
    const phone = css.split(/@media \(max-width:\s*720px\)/)[1] || "";
    expect(phone).toMatch(/\.t-btn:not\(\.ghost\)/);
    expect(phone).toMatch(/\.t-btn\.play/);
    expect(phone).toMatch(/min-width:\s*44px/);
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(phone).not.toMatch(/\.t-btn\.play\s*\{[^}]*width:\s*48px/);
    expect(phone).toMatch(/search-overlay__(input|go|cancel)[\s\S]*?min-height:\s*44px/);
    expect(phone).toMatch(/safe-area-inset-bottom/);
    expect(phone).toMatch(/grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
  });
});

describe("recent-dim / recent-deep", () => {
  it("exports both palettes on layout recent", () => {
    expect(RECENT_LAYOUT).toBe("recent");
    expect(RECENT_THEME_IDS).toEqual(["recent-dim", "recent-deep"]);
    expect(recentDim.id).toBe("recent-dim");
    expect(recentDeep.id).toBe("recent-deep");
    expect(recentDim.layout).toBe("recent");
    expect(recentDeep.layout).toBe("recent");
    expect(isRecentThemeId("recent-dim")).toBe(true);
    expect(isRecentThemeId("aurora")).toBe(false);
    expect(getRecentTheme("recent-deep").id).toBe("recent-deep");
  });

  it("has full tokens and css vars", () => {
    for (const t of RECENT_THEMES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(t.taglineEn)).toBe(false);
      expect(t.accent).toMatch(/^#|^rgb|oklch|hsl/);
      expect(t.bg).toMatch(/^#/);
      const vars = recentThemeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
      expect(vars["--radius"]).toBeTruthy();
    }
  });

  it("keeps dim muted and deep saturated", () => {
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(recentDim.bg)).toBeLessThan(40);
    expect(lum(recentDeep.bg)).toBeLessThan(lum(recentDim.bg));
    const sat = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      return Math.max(r, g, b) - Math.min(r, g, b);
    };
    expect(sat(recentDeep.accent)).toBeGreaterThan(sat(recentDim.accent));
  });
});

describe("recent i18n", () => {
  it("covers zh and en keys used by the shell", () => {
    const keys = Object.keys(recentCopy.zh);
    expect(keys.sort()).toEqual(Object.keys(recentCopy.en).sort());
    expect(rt("zh", "historyTitle")).toMatch(/足迹/);
    expect(rt("en", "historyTitle")).toMatch(/trail/i);
    expect(rt("zh", "count", { n: 3 })).toBe("3 首");
    expect(rt("en", "count", { n: 3 })).toBe("3 tracks");
  });
});
