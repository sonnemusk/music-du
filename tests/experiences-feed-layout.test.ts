import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { feedEn, feedT } from "../client/src/skins/experiences/feed/i18n.js";
import {
  THEMES,
  feedThemeToCssVars,
} from "../client/src/skins/experiences/feed/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exp = path.join(root, "client/src/skins/experiences/feed");
const tsx = fs.readFileSync(path.join(exp, "FeedLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(exp, "feed.css"), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, "m");
  const m = css.match(re);
  return m?.[1] ?? "";
}

describe("feed e2e layout polish", () => {
  it("does not use SkinHead and keeps two palettes", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(THEMES.map((t) => t.id).sort()).toEqual(["feed-deep", "feed-dim"]);
    expect(css).toMatch(/data-feed-theme="feed-dim"/);
    expect(css).toMatch(/data-feed-theme="feed-deep"/);
    for (const t of THEMES) {
      const vars = feedThemeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
    }
  });

  it("vertical swipe changes track and ignores [data-no-swipe]", () => {
    expect(tsx).toMatch(/onPointerDown/);
    expect(tsx).toMatch(/onPointerMove/);
    expect(tsx).toMatch(/onPointerUp/);
    expect(tsx).toMatch(/function ignoreSwipeTarget/);
    expect(tsx).toMatch(/closest\("\[data-no-swipe\]"\)/);
    expect(tsx).toMatch(/resolveVerticalSwipe/);
    expect(tsx).toMatch(/next\(dir === "up" \? 1 : -1\)/);
    expect(tsx).toMatch(/className="feed-chrome"[\s\S]*data-no-swipe/);
    expect(tsx).toMatch(/className="feed-deck"[\s\S]*data-no-swipe/);
    expect(tsx).toMatch(/className="feed-skips"/);
    expect(tsx).toMatch(/className="feed-transport"/);
    expect(tsx).toMatch(/className="feed-dock"[\s\S]*data-no-swipe/);
    expect(tsx).toMatch(/className="feed-caption"[\s\S]*data-no-swipe/);
  });

  it("visible prev/play/next are 44×44 and share one dock-row height", () => {
    const skip = rule(".feed-skip");
    const play = rule(".feed-skip--play");
    const row = rule(".feed-skips");
    expect(skip).toMatch(/min-width:\s*44px/);
    expect(skip).toMatch(/min-height:\s*44px/);
    expect(skip).toMatch(/width:\s*44px/);
    expect(skip).toMatch(/height:\s*44px/);
    expect(play).toMatch(/min-width:\s*44px/);
    expect(play).toMatch(/min-height:\s*44px/);
    expect(play).toMatch(/width:\s*44px/);
    expect(play).toMatch(/height:\s*44px/);
    expect(play).not.toMatch(/52px|56px/);
    expect(row).toMatch(/flex-direction:\s*row/);
    expect(row).toMatch(/align-items:\s*center/);
    expect(row).toMatch(/height:\s*var\(--feed-skip\)/);
    expect(css).toMatch(/--feed-skip:\s*44px/);

    const dockTrio = rule(".layout-feed .transport .t-btn:not(.ghost)");
    const dockPlay = rule(".layout-feed .transport .t-btn.play");
    expect(dockTrio).toMatch(/min-width:\s*44px/);
    expect(dockTrio).toMatch(/min-height:\s*44px/);
    expect(dockPlay).toMatch(/height:\s*44px/);
    expect(dockPlay).not.toMatch(/52px|56px/);
  });

  it("queue chips are ≥36px and scroll instead of wrapping badly", () => {
    const chips = rule(".feed-chips");
    const chip = rule(".feed-chip");
    expect(chips).toMatch(/flex-wrap:\s*nowrap/);
    expect(chips).toMatch(/overflow-x:\s*auto/);
    expect(chip).toMatch(/min-height:\s*(36px|var\(--feed-chip\))/);
    expect(chip).toMatch(/height:\s*(36px|var\(--feed-chip\))/);
    expect(css).toMatch(/--feed-chip:\s*36px/);
    expect(chip).toMatch(/white-space:\s*nowrap/);
    expect(tsx).toMatch(/queueFavorites/);
    expect(tsx).toMatch(/queueHistory/);
    expect(tsx).toMatch(/queuePlaylist/);
    expect(tsx).toMatch(/queueCharts/);
  });

  it("search is desktop SearchBar and phone overlay launch ≥44px", () => {
    expect(tsx).toMatch(/SearchBar className="feed-search"/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/feed-search-launch/);
    expect(tsx).toMatch(/isMobileSearchUi|max-width:\s*720px/);
    expect(css).toMatch(
      /\.feed-search-launch,\s*\.feed-sheet-close\s*\{[^}]*width:\s*44px/s
    );
    expect(css).toMatch(
      /\.feed-search-launch,\s*\.feed-sheet-close\s*\{[^}]*height:\s*44px/s
    );
    expect(rule(".feed-search")).toMatch(/min-height:\s*44px/);
  });

  it("lyrics, theme, and locale stay reachable", () => {
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/openLyrics/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(feedT("zh", "lyrics")).toBeTruthy();
    expect(feedT("en", "lyrics")).toMatch(/lyric/i);
    expect(feedEn.navAria).toMatch(/track/i);
  });

  it("phone lyrics replace the reel in-page; queue keeps the sheet close", () => {
    expect(tsx).toMatch(/className="feed-verse"/);
    expect(tsx).toMatch(/mobile && dock === "lyrics"/);
    expect(tsx).toMatch(/setSheetOpen\(false\)/);
    expect(tsx).toMatch(/className="feed-sheet-close"/);
    expect(css).toMatch(/\.feed-verse[\s\S]{0,80}min-height:\s*0/);
  });

  it("covers 390–1280 without horizontal overflow", () => {
    expect(css).toContain("720px");
    expect(css.includes("1024px") || css.includes("1023px")).toBe(true);
    expect(css).toContain("390px");
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toMatch(/safe-area-inset/);
    expect(rule(".layout-feed")).toMatch(/max-width:\s*100%/);
  });

  it("transport extras stay horizontal — no vertical Chinese glyphs", () => {
    expect(css).toMatch(
      /\.layout-feed \.transport \.t-btn\.ghost[\s\S]{0,400}writing-mode:\s*horizontal-tb/
    );
    expect(css).toMatch(
      /\.layout-feed \.transport \.t-btn\.ghost[\s\S]{0,400}white-space:\s*nowrap/
    );
    expect(css).toMatch(
      /\.layout-feed \.transport \.t-btn\.ghost[\s\S]{0,400}width:\s*auto\s*!important/
    );
    expect(css).toMatch(
      /\.layout-feed \.transport \.t-btn\.ghost[\s\S]{0,400}min-width:\s*max-content/
    );
    expect(css).toMatch(
      /\.layout-feed \.quality-wrap[\s\S]{0,200}writing-mode:\s*horizontal-tb/
    );
    expect(rule(".layout-feed .transport-row")).toMatch(/flex-wrap:\s*wrap/);
    expect(rule(".layout-feed .transport-row")).toMatch(/writing-mode:\s*horizontal-tb/);
  });

  it("cover is centered and play hits sit under the poster, not on the art", () => {
    expect(css).toMatch(/object-position:\s*center/);
    expect(rule(".feed-stage")).toMatch(/align-items:\s*center/);
    expect(rule(".feed-reel")).toMatch(/max-width:\s*560px/);
    expect(tsx).toMatch(/className="feed-deck"/);
    expect(rule(".feed-deck")).toMatch(/flex-direction:\s*column/);
    expect(rule(".feed-skips")).toMatch(/position:\s*static/);
    expect(rule(".feed-skips")).toMatch(/justify-content:\s*center/);
    expect(rule(".feed-card__meta")).toMatch(/bottom:\s*20px/);
    expect(rule(".feed-card__meta")).not.toMatch(/--feed-skip/);
  });
});
