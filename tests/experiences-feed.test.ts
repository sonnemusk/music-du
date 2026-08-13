import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { feedT } from "../client/src/skins/experiences/feed/i18n.js";
import {
  LAYOUT_ID,
  LAYOUT_META,
  THEMES,
  feedThemeToCssVars,
  getFeedTheme,
} from "../client/src/skins/experiences/feed/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exp = path.join(root, "client/src/skins/experiences/feed");

const tsx = fs.readFileSync(path.join(exp, "FeedLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(exp, "feed.css"), "utf8");
const plan = fs.readFileSync(path.join(exp, "PLAN.md"), "utf8");
const themeSrc = fs.readFileSync(path.join(exp, "theme.ts"), "utf8");

describe("feed experience", () => {
  it("exports layout id, two palettes, and meta", () => {
    expect(LAYOUT_ID).toBe("feed");
    expect(LAYOUT_META.feed.name).toBeTruthy();
    expect(THEMES.map((t) => t.id).sort()).toEqual(["feed-deep", "feed-dim"]);
    for (const t of THEMES) {
      expect(t.layout).toBe("feed");
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(t.taglineEn.length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      const vars = feedThemeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
    }
    expect(getFeedTheme("feed-deep").id).toBe("feed-deep");
    expect(getFeedTheme("missing").id).toBe("feed-dim");
    expect(themeSrc).toMatch(/layout:\s*"feed"/);
  });

  it("does not use SkinHead or TabNav as chrome", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).toMatch(/export function FeedLayout/);
    expect(tsx).toMatch(/brand/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/CoverImg/);
  });

  it("has swipe / pointer handlers that call next(+1/-1)", () => {
    expect(tsx).toMatch(/onPointerDown/);
    expect(tsx).toMatch(/onPointerUp/);
    expect(tsx).toMatch(/onPointerMove/);
    expect(tsx).toMatch(/onPointerCancel/);
    expect(tsx).toMatch(/onWheel/);
    expect(tsx).toMatch(/next\(\s*-1\s*\)/);
    expect(tsx).toMatch(/next\(\s*1\s*\)/);
    expect(tsx).toMatch(/next\(\s*dy\s*<\s*0\s*\?\s*1\s*:\s*-1\s*\)/);
    expect(tsx).toMatch(/ignoreSwipeTarget/);
    expect(tsx).toMatch(/\[data-no-swipe\]/);
    expect(tsx).toMatch(/className="feed-skips"/);
    expect(tsx).toMatch(/feed-skip--play/);
  });

  it("switches queue among favorites / history / playlist / charts only", () => {
    expect(tsx).toMatch(/"favorites"/);
    expect(tsx).toMatch(/"history"/);
    expect(tsx).toMatch(/"playlist"/);
    expect(tsx).toMatch(/"charts"/);
    expect(tsx).not.toMatch(/daily recommend|vip|comment|video/i);
    expect(plan).toMatch(/收藏/);
    expect(plan).toMatch(/历史/);
  });

  it("css has 720px plus another breakpoint and 44px targets", () => {
    expect(css).toContain("720px");
    expect(css.includes("1024px") || css.includes("1023px")).toBe(true);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/min-width:\s*44px/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/overflow:\s*hidden/);
  });

  it("ships local i18n for zh and en", () => {
    expect(feedT("zh", "layoutName")).toBe("竖滑");
    expect(feedT("en", "layoutName")).toBe("Reel");
    expect(feedT("zh", "queueFavorites")).toBeTruthy();
    expect(feedT("en", "swipeHint")).toMatch(/swipe/i);
  });

  it("does not add social / video / paid-tier surfaces", () => {
    expect(tsx).not.toMatch(/评论区/);
    expect(tsx).not.toMatch(/<video/i);
    expect(css).not.toMatch(/<video/i);
    expect(tsx).not.toMatch(/dailyRecommend|daily-recommend/);
  });
});
