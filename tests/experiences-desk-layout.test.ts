import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { zh } from "../client/src/i18n/zh.js";
import { en } from "../client/src/i18n/en.js";
import { THEMES } from "../client/src/skins/experiences/desk/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/desk");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

const tsx = read("DeskLayout.tsx");
const css = read("desk.css");

const FOOT_TABS = ["charts", "favorites", "playlist", "history", "lyrics"] as const;

describe("desk layout chrome", () => {
  it("does not use SkinHead or shared layout shells", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/SkinChrome/);
    expect(tsx).not.toMatch(/SideLayout|ImmersiveLayout|CompactLayout|GalleryLayout/);
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("ships two palettes desk-dim and desk-deep", () => {
    expect(THEMES.map((t) => t.id).sort()).toEqual(["desk-deep", "desk-dim"]);
    expect(new Set(THEMES.map((t) => t.bg.toLowerCase())).size).toBe(2);
  });

  it("keeps play / prev / next at a unified 44px on the same row", () => {
    expect(css).toMatch(/\.desk-play[\s\S]{0,280}min-width:\s*44px/);
    expect(css).toMatch(/\.desk-prev[\s\S]{0,280}min-width:\s*44px/);
    expect(css).toMatch(/\.desk-next[\s\S]{0,280}min-width:\s*44px/);
    expect(css).toMatch(/\.desk-play[\s\S]{0,280}min-height:\s*44px/);
    expect(css).toMatch(/\.desk-trio\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.desk-extras\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.desk-top\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.desk-tools\s*\{[^}]*align-items:\s*center/s);
    expect(tsx).toMatch(/desk-prev/);
    expect(tsx).toMatch(/desk-play/);
    expect(tsx).toMatch(/desk-next/);
  });

  it("search bar can shrink so tools stay on-screen", () => {
    expect(css).toMatch(/\.desk-search\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.desk-top\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.desk-tools\s*\{[^}]*min-width:\s*0/s);
    expect(tsx).toMatch(/SearchBar className="desk-search"/);
    expect(tsx).toMatch(/max-width: 1024px/);
  });

  it("locale and theme tools live in the stage header, never the rail", () => {
    const rail = tsx.match(/<aside className="desk-rail">[\s\S]*?<\/aside>/)?.[0] ?? "";
    const top = tsx.match(/<header className="desk-top">[\s\S]*?<\/header>/)?.[0] ?? "";
    expect(top).toMatch(/<DeskTools \/>/);
    expect(rail).not.toMatch(/DeskTools/);
    expect(tsx).not.toMatch(/toolsInTop/);
    expect(css).toMatch(/\.desk-top \.desk-tools\s*\{[^}]*flex-wrap:\s*nowrap/s);
    expect(css).toMatch(/\.desk-tools \.skin-switcher__bar\s*\{[^}]*flex-wrap:\s*nowrap/s);
    expect(css).not.toMatch(/\.desk-rail \.desk-tools/);
  });

  it("desktop dock aligns to the left rail column", () => {
    expect(css).toMatch(
      /@media \(min-width:\s*1025px\)[\s\S]*?grid-template-columns:\s*var\(--desk-rail\)\s+minmax\(0,\s*1fr\)/
    );
    expect(css).toMatch(/\.desk-dock\.player-bar/);
    expect(css).toMatch(/grid-template-areas:[\s\S]*"dock dock"/);
    expect(tsx).toMatch(/desk-dock/);
    expect(tsx).toMatch(/player-bar/);
    expect(tsx).toMatch(/<Transport/);
  });
});

describe("desk phone + overflow + stack", () => {
  it("phone uses mini bar + foot nav with 2+ character tab labels", () => {
    expect(tsx).toMatch(/desk-mini/);
    expect(tsx).toMatch(/desk-foot/);
    expect(tsx).toMatch(/const FOOT: PanelTab\[\] = \["charts", "favorites", "playlist", "history", "lyrics"\]/);
    expect(tsx).toMatch(/<span>\{tabLabel\(tr, id, false\)\}<\/span>/);
    expect(tsx).not.toMatch(/desk-foot__btn[\s\S]{0,200}tabLabel\(tr, id, true\)/);
    for (const id of FOOT_TABS) {
      expect([...zh.tabs[id]].length, `zh ${id}`).toBeGreaterThanOrEqual(2);
      expect(en.tabs[id].length, `en ${id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("reaches search, favorites, history, playlist, charts, lyrics, transport on both viewports", () => {
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/"favorites"/);
    expect(tsx).toMatch(/"history"/);
    expect(tsx).toMatch(/"playlist"/);
    expect(tsx).toMatch(/"charts"/);
    expect(tsx).toMatch(/"lyrics"/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/QualityPicker/);
    expect(tsx).toMatch(/cycleMode/);
    expect(tsx).toMatch(/toggleFavorite/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/<Transport compact/);
    expect(tsx).toMatch(/<Transport \/>/);
  });

  it("clips horizontal overflow at common widths", () => {
    expect(css).toMatch(/\.layout-desk\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.layout-desk\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.desk-dock\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.desk-stage\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(max-width:\s*1024px\)/);
  });

  it("keeps seek, volume, and quality visible while idle", () => {
    expect(css).toMatch(/\[data-idle="1"\] \.layout-desk \.seek-row/);
    expect(css).toMatch(/\[data-idle="1"\] \.layout-desk \.vol-row/);
    expect(css).toMatch(/\[data-idle="1"\] \.layout-desk \.quality-wrap/);
  });

  it("stacks chrome below overlay 900 and theme 2000", () => {
    expect(css).toMatch(/--desk-z-chrome:\s*40/);
    expect(css).toMatch(/--desk-z-overlay:\s*900/);
    expect(css).toMatch(/--desk-z-theme:\s*2000/);
    const zVals = [...css.matchAll(/^\s*z-index:\s*(\d+)/gm)].map((m) => Number(m[1]));
    expect(zVals.length).toBeGreaterThan(0);
    expect(Math.max(...zVals)).toBeLessThan(900);
    expect(zVals.every((z) => z < 900)).toBe(true);
  });
});
