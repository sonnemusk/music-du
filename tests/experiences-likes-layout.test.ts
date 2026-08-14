import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LIKES_THEME_IDS,
  likesDeep,
  likesDim,
} from "../client/src/skins/experiences/likes/theme.js";
import { likesI18n, likesT } from "../client/src/skins/experiences/likes/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/likes");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

const DEST_IDS = ["favorites", "search", "history", "charts", "lyrics", "playlist"] as const;

describe("likes e2e layout polish", () => {
  const tsx = read("LikesLayout.tsx");
  const css = read("likes.css");

  it("opens on favorites and never mounts SkinHead", () => {
    expect(tsx).toMatch(/setTab\("favorites"\)/);
    expect(tsx).toMatch(/mode="favorites"/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
  });

  it("ships likes-dim and likes-deep", () => {
    expect(LIKES_THEME_IDS).toEqual(["likes-dim", "likes-deep"]);
    expect(likesDim.id).toBe("likes-dim");
    expect(likesDeep.id).toBe("likes-deep");
    expect(likesDim.bg).not.toBe(likesDeep.bg);
    expect(css).toMatch(/data-likes-palette|likes-palettes/);
    expect(tsx).toMatch(/likes-dim/);
    expect(tsx).toMatch(/likes-deep/);
  });

  it("applies dim/deep from the shared player skin so the catalog picker works", () => {
    expect(tsx).toMatch(/usePlayer\(\(s\) => s\.skin\)/);
    expect(tsx).toMatch(/usePlayer\(\(s\) => s\.setSkin\)/);
    expect(tsx).toMatch(/setSkin\(id\)/);
    expect(tsx).not.toMatch(/kazam\.v2\.likesPalette/);
    expect(tsx).not.toMatch(/loadPalette|savePalette/);
  });

  it("splits chrome at 720px and pins phone dest at 390", () => {
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
    expect(css).toMatch(/@media \(max-width:\s*390px\)/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/minmax\(0,\s*1fr\)/);
  });

  it("keeps mini prev/play/next the same 44×44 hit", () => {
    expect(tsx).toMatch(/data-likes-ctrl="prev"/);
    expect(tsx).toMatch(/data-likes-ctrl="play"/);
    expect(tsx).toMatch(/data-likes-ctrl="next"/);
    expect(css).toMatch(/--likes-hit:\s*44px/);
    expect(css).toMatch(/\.likes-mini__btn,\s*\n\s*\.likes-mini__btn\.play/);
    expect(css).toMatch(
      /\.likes-mini__btn,\s*\n\s*\.likes-mini__btn\.play\s*\{[\s\S]*?min-width:\s*var\(--likes-hit\)/
    );
    expect(css).toMatch(
      /\.likes-mini__btn,\s*\n\s*\.likes-mini__btn\.play\s*\{[\s\S]*?min-height:\s*var\(--likes-hit\)/
    );
    expect(css).not.toMatch(/\.likes-mini__btn\.play\s*\{[^}]*48px/);
    expect(tsx).not.toMatch(/likes-mini now-playing/);
    expect(css).toMatch(/grid-template-columns:\s*var\(--likes-hit\)\s+minmax\(0,\s*1fr\)\s+auto/);
    expect(css).toMatch(
      /\.likes-mini__title,[\s\S]*?text-overflow:\s*ellipsis[\s\S]*?white-space:\s*nowrap/
    );
  });

  it("keeps dest chips same height with full words, not 1-char", () => {
    expect(css).toMatch(/--likes-chip-h:\s*56px/);
    expect(css).toMatch(/\.likes-dest__item\s*\{[\s\S]*?height:\s*var\(--likes-chip-h\)/);
    expect(css).toMatch(/\.likes-dest--bar\s*\{[\s\S]*?overflow-x:\s*hidden/);
    expect(css).toMatch(/\.likes-dest--bar \.likes-dest__label[\s\S]*?display:\s*block/);
    expect(css).not.toMatch(/\.likes-dest--bar \.likes-dest__label\s*\{[^}]*display:\s*none/);
    for (const loc of ["zh", "en"] as const) {
      for (const id of DEST_IDS) {
        const word = likesT(loc, `dest.${id}`);
        expect(word.length, `${loc} dest.${id}`).toBeGreaterThan(1);
        expect(word).not.toMatch(/^.$/u);
      }
    }
    expect(likesI18n.zh.dest.playlist.length).toBeGreaterThan(1);
    expect(likesI18n.en.dest.history.length).toBeGreaterThan(1);
  });

  it("lets desktop SearchBar shrink and keeps the phone overlay launch at 44px", () => {
    expect(tsx).toMatch(/className="likes-search"/);
    expect(tsx).toMatch(/likes-search-launch/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(css).toMatch(/\.likes-search\s*\{[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/\.likes-search input\s*\{[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/\.likes-search-launch\s*\{[\s\S]*?min-width:\s*var\(--likes-hit\)/);
    expect(css).toMatch(/\.likes-search-launch\s*\{[\s\S]*?min-height:\s*var\(--likes-hit\)/);
  });

  it("aligns track cover / title / actions without overlap", () => {
    expect(css).toMatch(/\.likes \.track-row\s*\{[\s\S]*?align-items:\s*center/);
    expect(css).toMatch(/\.likes \.track-meta\s*\{[\s\S]*?min-width:\s*0/);
    expect(css).toMatch(/\.likes \.track-acts\s*\{[\s\S]*?flex:\s*0 0 auto/);
    expect(css).toMatch(/--likes-act:\s*36px/);
    expect(css).toMatch(
      /\.likes \.track-acts \.icon-btn\s*\{[\s\S]*?min-width:\s*var\(--likes-act\)/
    );
    expect(css).toMatch(
      /\.likes \.track-name,[\s\S]*?text-overflow:\s*ellipsis[\s\S]*?white-space:\s*nowrap/
    );
  });

  it("keeps the sheet quality menu above the transport", () => {
    expect(tsx).toMatch(/<Transport/);
    expect(tsx).toMatch(/likes-sheet/);
    expect(css).toMatch(/\.likes-sheet\s*\{[\s\S]*?z-index:\s*80/);
    expect(css).toMatch(/quality-menu[\s\S]*?z-index:\s*2000/);
    expect(css).toMatch(/\.likes \.transport\s*\{[\s\S]*?overflow:\s*visible/);
  });
});
