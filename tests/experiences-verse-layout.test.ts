import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  VERSE_THEMES,
  verseDeep,
  verseDim,
  verseThemeToCssVars,
} from "../client/src/skins/experiences/verse/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/verse");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

const tsx = read("VerseLayout.tsx");
const css = read("verse.css");

/** First rule body for a selector (ignores @media nesting). */
function decl(selector: string): string {
  const needle = `${selector} {`;
  const i = css.indexOf(needle);
  if (i < 0) return "";
  const start = i + needle.length;
  const end = css.indexOf("}", start);
  return end < 0 ? "" : css.slice(start, end);
}

describe("verse e2e layout — lyrics stage", () => {
  it("uses LyricsView panel inside a min-height-0 scroller", () => {
    expect(tsx).toMatch(/<LyricsView variant=["']panel["']\s*\/>/);
    expect(tsx).toMatch(/className="verse-lyrics"/);
    expect(decl(".verse-lyrics")).toMatch(/min-height:\s*0/);
    expect(decl(".verse-lyrics")).toMatch(/overflow:\s*hidden/);
    expect(decl(".verse-stage")).toMatch(/min-height:\s*0/);
    expect(css).toMatch(/\.verse \.lyrics-scroller[\s\S]{0,180}min-height:\s*0\s*!important/);
    expect(css).toMatch(/\.verse \.lyrics-scroller[\s\S]{0,240}overflow-y:\s*auto/);
    expect(css).toMatch(/scroll-margin-block:\s*16px/);
  });

  it("charts leaf does not repeat the Charts heading", () => {
    expect(css).toMatch(
      /\.verse-leaf:has\(\.charts-panel\) \.verse-leaf__title\s*\{[^}]*display:\s*none/s
    );
  });

  it("does not use SkinHead / TabNav chrome", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).toMatch(/className="verse-mast"/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/SkinSwitcher/);
  });
});

describe("verse e2e layout — mini dock", () => {
  it("prev / play / next share 44px height and sit on the title row", () => {
    expect(tsx).toMatch(/className="verse-ctrl"/);
    expect(tsx).toMatch(/verse-ctrl verse-ctrl--play/);
    expect(tsx).toMatch(/next\(-1\)/);
    expect(tsx).toMatch(/togglePlay/);
    expect(tsx).toMatch(/next\(1\)/);
    const ctrls = decl(".verse-ctrl,\n.verse-ctrl--play") || decl(".verse-ctrl,");
    expect(css).toMatch(/--verse-ctrl:\s*44px/);
    expect(css).toMatch(/\.verse-ctrl,\s*\n\s*\.verse-ctrl--play\s*\{[^}]*min-width:\s*44px/s);
    expect(css).toMatch(/\.verse-ctrl,\s*\n\s*\.verse-ctrl--play\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.verse-ctrl,\s*\n\s*\.verse-ctrl--play\s*\{[^}]*height:\s*var\(--verse-ctrl\)/s);
    expect(css).not.toMatch(/\.verse-ctrl--play\s*\{[^}]*52px/s);
    expect(css).toMatch(/"art meta ctrls"/);
    expect(css).toMatch(/\.verse \.verse-dock\.player-bar\s*\{[^}]*align-items:\s*center/s);
    expect(decl(".verse-ctrls")).toMatch(/align-self:\s*center/);
    expect(decl(".verse-ctrls")).toMatch(/height:\s*var\(--verse-ctrl\)/);
    expect(ctrls.length + css.length).toBeGreaterThan(0);
  });

  it("pads the dock with safe-area and beats player-bar grid", () => {
    expect(tsx).toMatch(/className="verse-dock player-bar"/);
    expect(css).toMatch(
      /\.verse \.verse-dock\.player-bar\s*\{[^}]*padding:[^;]*safe-area-inset-bottom/s
    );
    expect(css).toMatch(/grid-template-columns:\s*48px minmax\(0,\s*1fr\) auto/);
    expect(css).toMatch(/z-index:\s*6/);
  });
});

describe("verse e2e layout — index keys", () => {
  it("aligns search / charts / likes / history / playlist on a 6-col grid", () => {
    expect(tsx).toMatch(/data-key=\{id\}/);
    expect(tsx).toMatch(/\["lyrics", "search", "charts", "playlist", "favorites", "history"\]/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.verse-key,\s*\n\s*\.verse-key--search\s*\{[^}]*min-width:\s*44px/s);
    expect(css).toMatch(/\.verse-key,\s*\n\s*\.verse-key--search\s*\{[^}]*min-height:\s*44px/s);
  });

  it("phone search overlay launch is a 44px key", () => {
    expect(tsx).toMatch(/verse-key--search/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(css).toMatch(
      /@media \(max-width:\s*720px\)[\s\S]*\.verse-key--search[\s\S]{0,120}min-width:\s*44px/
    );
    expect(css).toMatch(
      /@media \(max-width:\s*720px\)[\s\S]*\.verse-key--search[\s\S]{0,160}min-height:\s*44px/
    );
  });
});

describe("verse e2e layout — leaf sheet", () => {
  it("keeps the sheet inside the body so it cannot cover the dock", () => {
    expect(tsx).toMatch(/className="verse-leaf"/);
    expect(tsx).toMatch(/className="verse-close"/);
    expect(decl(".verse-body")).toMatch(/position:\s*relative/);
    expect(decl(".verse-body")).toMatch(/overflow:\s*hidden/);
    expect(decl(".verse-leaf")).toMatch(/position:\s*absolute/);
    expect(decl(".verse-leaf")).toMatch(/bottom:\s*8px/);
    expect(decl(".verse-leaf")).toMatch(/max-height:\s*calc\(100% - 16px\)/);
    expect(decl(".verse-leaf")).toMatch(/z-index:\s*5/);
    expect(decl(".verse-close")).toMatch(/min-width:\s*44px/);
    expect(decl(".verse-close")).toMatch(/min-height:\s*44px/);
    expect(decl(".verse-leaf__head")).toMatch(/overflow:\s*visible/);
    expect(decl(".verse-leaf__head")).toMatch(/min-height:\s*44px/);
  });
});

describe("verse e2e layout — overflow + header + palettes", () => {
  it("locks the shell at 390–1280 with overflow hidden and 720px split", () => {
    expect(decl(".verse")).toMatch(/overflow:\s*hidden/);
    expect(decl(".verse")).toMatch(/100dvh/);
    expect(decl(".verse")).toMatch(/max-width:\s*100%/);
    expect(css.includes("720px")).toBe(true);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(min-width:\s*720px\)/);
    expect(decl(".verse-mast")).toMatch(/overflow:\s*hidden/);
    expect(decl(".verse-tools")).toMatch(/max-width:\s*min\(68%,\s*22rem\)/);
    expect(css).toMatch(
      /\.verse \.skin-switcher__btn\.primary \.skin-switcher__label-full\s*\{[^}]*display:\s*none/s,
    );
  });

  it("keeps theme + locale in the mast", () => {
    const mast = tsx.slice(tsx.indexOf("verse-mast"), tsx.indexOf("verse-body"));
    expect(mast).toMatch(/LocaleSwitcher/);
    expect(mast).toMatch(/SkinSwitcher/);
    expect(css).toMatch(/\.verse \.locale-switch[\s\S]{0,80}min-width:\s*44px/);
  });

  it("ships verse-dim and verse-deep as two distinct palettes", () => {
    expect(verseDim.id).toBe("verse-dim");
    expect(verseDeep.id).toBe("verse-deep");
    expect(verseDim.layout).toBe("verse");
    expect(verseDeep.layout).toBe("verse");
    expect(VERSE_THEMES).toHaveLength(2);
    expect(verseThemeToCssVars(verseDim)["--bg"]).not.toBe(
      verseThemeToCssVars(verseDeep)["--bg"]
    );
    expect(css).toMatch(/\[data-verse="verse-dim"\]/);
    expect(css).toMatch(/\[data-verse="verse-deep"\]/);
  });

  it("sizes the search overlay from the live dock height", () => {
    expect(tsx).toMatch(/ResizeObserver/);
    expect(tsx).toMatch(/--search-overlay-bottom/);
    expect(tsx).toMatch(/dockRef/);
  });
});
