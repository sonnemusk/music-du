import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIKES_THEME,
  LIKES_LAYOUT,
  LIKES_THEME_IDS,
  LIKES_THEMES,
  getLikesTheme,
  isLikesThemeId,
  likesDeep,
  likesDim,
  likesThemeToCssVars,
} from "../client/src/skins/experiences/likes/theme.js";
import { likesI18n, likesT } from "../client/src/skins/experiences/likes/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/likes");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("likes experience files", () => {
  it("ships only the allowed experience files", () => {
    expect(fs.existsSync(path.join(dir, "PLAN.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "LikesLayout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "likes.css"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "theme.ts"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "i18n.ts"))).toBe(true);
  });
});

describe("likes layout contract", () => {
  const tsx = read("LikesLayout.tsx");

  it("exports LikesLayout({ brand }) and lands on favorites", () => {
    expect(tsx).toMatch(/export function LikesLayout\(\{\s*brand\s*\}/);
    expect(tsx).toMatch(/setTab\("favorites"\)/);
    expect(tsx).toMatch(/usePlayer/);
  });

  it("does not use SkinHead / TabNav / other layout shells", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/SkinChrome/);
    expect(tsx).not.toMatch(/CompactLayout|GalleryLayout|ImmersiveLayout|SideLayout/);
  });

  it("reuses the allowed player surfaces", () => {
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/mode="favorites"/);
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/SearchOverlay|openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/CoverImg/);
  });

  it("stays inside the hard content boundary", () => {
    expect(tsx).not.toMatch(/comment|social|video|VIP|daily.?recommend/i);
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("likes css", () => {
  const css = read("likes.css");

  it("splits desktop and phone at 720px+", () => {
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
  });

  it("meets 44px touch targets, dvh, and safe-area", () => {
    expect(css).toMatch(/min-(width|height):\s*44px/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/overflow:\s*hidden/);
  });
});

describe("likes-dim / likes-deep", () => {
  it("exports both palettes on layout likes", () => {
    expect(LIKES_LAYOUT).toBe("likes");
    expect(LIKES_THEME_IDS).toEqual(["likes-dim", "likes-deep"]);
    expect(DEFAULT_LIKES_THEME).toBe("likes-dim");
    expect(isLikesThemeId("likes-dim")).toBe(true);
    expect(isLikesThemeId("likes-deep")).toBe(true);
    expect(likesDim.id).toBe("likes-dim");
    expect(likesDeep.id).toBe("likes-deep");
    expect(likesDim.layout).toBe("likes");
    expect(likesDeep.layout).toBe("likes");
  });

  it("dim is muted dark and deep is saturated deep dark", () => {
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(likesDim.bg)).toBeLessThan(50);
    expect(lum(likesDeep.bg)).toBeLessThan(lum(likesDim.bg));
    expect(likesDim.accent).not.toBe(likesDeep.accent);
    for (const t of LIKES_THEMES) {
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(t.taglineEn)).toBe(false);
      const vars = likesThemeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
      expect(vars["--wallpaper"]).toBeTruthy();
    }
    expect(getLikesTheme("likes-deep").id).toBe("likes-deep");
  });
});

describe("likes i18n", () => {
  it("covers zh and en chrome copy", () => {
    expect(likesI18n.zh.homeTitle).toBeTruthy();
    expect(likesI18n.en.homeTitle).toBeTruthy();
    expect(likesT("zh", "homeTitle")).toBe(likesI18n.zh.homeTitle);
    expect(likesT("en", "dest.playlist")).toBe(likesI18n.en.dest.playlist);
    expect(likesT("en", "count", { n: 3 })).toContain("3");
  });
});
