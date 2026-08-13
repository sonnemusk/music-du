import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SPLIT_LAYOUT,
  SPLIT_THEME_IDS,
  SPLIT_THEMES,
} from "../client/src/skins/experiences/split/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/split");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

/** Collect @media bodies whose query matches `pred`. Nested braces stay intact. */
function mediaBodies(css: string, pred: (query: string) => boolean): string {
  const chunks: string[] = [];
  const re = /@media\s*([^{]+)\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const query = m[1].trim();
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      const ch = css[i++];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    if (pred(query)) chunks.push(css.slice(m.index + m[0].length, i - 1));
  }
  return chunks.join("\n");
}

function stripMedia(css: string): string {
  const re = /@media\s*[^{]+\{/g;
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    out += css.slice(last, m.index);
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < css.length && depth > 0) {
      const ch = css[i++];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    last = i;
  }
  return out + css.slice(last);
}

describe("split two-pane vs stacked", () => {
  const css = read("split.css");
  const tsx = read("SplitLayout.tsx");
  const base = stripMedia(css);
  const desktop = mediaBodies(css, (q) => /min-width:\s*721px/.test(q) && !/1024px/.test(q));
  const tablet = mediaBodies(
    css,
    (q) => /1024px/.test(q) && /min-width:\s*721px/.test(q)
  );
  const phone = mediaBodies(css, (q) => /max-width:\s*720px/.test(q));

  it("does not use SkinHead or TabNav", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/from ["'].*layouts\//);
  });

  it("declares both 720 and 1024 breakpoints plus the 721 two-pane floor", () => {
    expect(css).toMatch(/@media \(max-width: 720px\)/);
    expect(css).toMatch(/@media \(min-width: 721px\)/);
    expect(css).toMatch(/max-width:\s*1024px/);
    expect(desktop.length).toBeGreaterThan(40);
    expect(tablet.length).toBeGreaterThan(40);
    expect(phone.length).toBeGreaterThan(40);
  });

  it("desktop ≥721 is two-pane grid: player | spine | list", () => {
    const grid = `${base}\n${desktop}`;
    expect(grid).toMatch(
      /grid-template-columns:\s*var\(--split-player-w\)\s+var\(--split-spine-w\)\s+minmax\(0,\s*1fr\)/
    );
    expect(tsx).toMatch(/data-split-mode=\{phone \? "stacked" : "two-pane"\}/);
    expect(desktop).toMatch(/\.split-desk\s*\{[^}]*display:\s*grid/s);
    expect(desktop).not.toMatch(/flex-direction:\s*column/);
  });

  it("tablet ≤1024 stays two-pane and only tightens the player", () => {
    expect(tablet).toMatch(/--split-player-w/);
    expect(tablet).toMatch(/--split-spine-w/);
    expect(tablet).not.toMatch(/flex-direction:\s*column/);
    expect(tablet).not.toMatch(/grid-template-columns:\s*none/);
  });

  it("phone ≤720 stacks player on top of the list", () => {
    expect(phone).toMatch(/\.split-desk\s*\{[^}]*flex-direction:\s*column/s);
    expect(phone).toMatch(/\.split-player\s*\{[^}]*flex:\s*0 0 auto/s);
    expect(phone).toMatch(/\.split-list\s*\{[^}]*flex:\s*1 1 auto/s);
    expect(css).toMatch(/padding:\s*env\(safe-area-inset-top/);
  });

  it("list column scrolls independently (min-height 0)", () => {
    expect(css).toMatch(/\.split-list\s*\{[^}]*min-height:\s*0/s);
    expect(css).toMatch(/\.split-pane\s*\{[^}]*min-height:\s*0/s);
    expect(css).toMatch(/\.split-pane\s*\{[^}]*overflow:\s*auto/s);
    expect(`${base}\n${desktop}`).toMatch(/\.split-list\s*\{[^}]*overflow:\s*hidden/s);
    expect(phone).toMatch(/\.split-list\s*\{[^}]*min-height:\s*0/s);
  });
});

describe("split unified 44px hits", () => {
  const css = read("split.css");
  const phone = mediaBodies(css, (q) => /max-width:\s*720px/.test(q));

  it("exports a single 44px hit token used by prev/play/next, spine, search", () => {
    expect(css).toMatch(/--split-hit:\s*44px/);
    expect(css).toMatch(/\.t-btn\s*\{[^}]*min-width:\s*var\(--split-hit\)/s);
    expect(css).toMatch(/\.t-btn\s*\{[^}]*min-height:\s*var\(--split-hit\)/s);
    expect(css).toMatch(/split-search-launch\s*\{[^}]*min-width:\s*var\(--split-hit\)/s);
    expect(css).toMatch(/split-spine__btn\s*\{[^}]*min-height:\s*var\(--split-hit\)/s);
  });

  it("phone prev/play/next share the same 44×44 height", () => {
    expect(phone).toMatch(/--split-play:\s*var\(--split-hit\)/);
    expect(phone).toMatch(/\.t-btn\.play[\s\S]*min-width:\s*var\(--split-hit\)/);
    expect(phone).toMatch(/\.t-btn\.play[\s\S]*min-height:\s*var\(--split-hit\)/);
    expect(phone).toMatch(/\.t-btn\.play[\s\S]*height:\s*var\(--split-hit\)/);
    expect(phone).not.toMatch(/\.t-btn\.play[\s\S]{0,180}(48|56)px/);
  });

  it("phone overlay launch and tools are ≥44", () => {
    expect(phone).toMatch(/split-search-launch[\s\S]*min-width:\s*var\(--split-hit\)/);
    expect(phone).toMatch(/skin-switcher__btn[\s\S]*min-height:\s*var\(--split-hit\)/);
    expect(css).toMatch(
      /html:has\(\.split-root\) \.search-overlay__(input|cancel|go)[\s\S]*min-height:\s*44px/
    );
  });
});

describe("split spine + title alignment", () => {
  const css = read("split.css");
  const tsx = read("SplitLayout.tsx");
  const phone = mediaBodies(css, (q) => /max-width:\s*720px/.test(q));

  it("spine order is 收藏/历史/搜索/榜单/列表/歌词", () => {
    expect(tsx).toMatch(
      /const SECTIONS: PanelTab\[] = \[\s*"favorites",\s*"history",\s*"search",\s*"charts",\s*"playlist",\s*"lyrics",\s*]/
    );
  });

  it("phone spine tabs share 44px height and wrap without overflow-x", () => {
    expect(phone).toMatch(/\.split-spine\s*\{[^}]*flex-wrap:\s*wrap/s);
    expect(phone).toMatch(/\.split-spine\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(phone).toMatch(/\.split-spine__btn\s*\{[^}]*height:\s*var\(--split-hit\)/s);
    expect(phone).toMatch(/\.split-spine__btn\s*\{[^}]*max-height:\s*var\(--split-hit\)/s);
    expect(phone).not.toMatch(/overflow-x:\s*auto/);
  });

  it("desktop SearchBar; phone opens the overlay instead", () => {
    expect(tsx).toMatch(/\{!phone \? \([\s\S]*<SearchBar className="split-search"/);
    expect(tsx).toMatch(/phone \? \([\s\S]*split-search-launch/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/if \(id === "search" && phone\)/);
    expect(css).toMatch(/\.split-search\s*\{[^}]*height:\s*var\(--split-hit\)/s);
  });

  it("title cannot overflow into transport buttons", () => {
    expect(css).toMatch(/\.split-now__title\s*\{[^}]*overflow:\s*hidden/s);
    expect(phone).toMatch(/\.split-now__title\s*\{[^}]*text-overflow:\s*ellipsis/s);
    expect(phone).toMatch(/\.split-now__title\s*\{[^}]*white-space:\s*nowrap/s);
    expect(phone).toMatch(/\.split-now__text\s*\{[^}]*min-width:\s*0/s);
    expect(phone).toMatch(/\.split-now\.now-playing[\s\S]*flex-direction:\s*row/);
    expect(phone).toMatch(/\.split-now[\s\S]*overflow:\s*hidden/);
    expect(tsx).toMatch(/className="split-now__title" title=\{title\}/);
    expect(tsx).toMatch(/split-player__stage/);
    expect(tsx).toMatch(/split-transport/);
  });

  it("root keeps 100dvh and safe-area on every side", () => {
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset-top/);
    expect(css).toMatch(/safe-area-inset-right/);
    expect(css).toMatch(/safe-area-inset-bottom/);
    expect(css).toMatch(/safe-area-inset-left/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
  });
});

describe("split palettes stay on the split layout", () => {
  it("ships split-dim and split-deep only", () => {
    expect(SPLIT_LAYOUT).toBe("split");
    expect(SPLIT_THEME_IDS).toEqual(["split-dim", "split-deep"]);
    expect(SPLIT_THEMES.map((t) => t.id)).toEqual(["split-dim", "split-deep"]);
    expect(SPLIT_THEMES.every((t) => t.layout === "split")).toBe(true);
  });
});
