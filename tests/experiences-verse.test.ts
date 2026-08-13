import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { verseI18n, verseT } from "../client/src/skins/experiences/verse/i18n.js";
import {
  VERSE_LAYOUT,
  VERSE_THEMES,
  getVerseTheme,
  verseDeep,
  verseDim,
} from "../client/src/skins/experiences/verse/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/verse");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("verse experience", () => {
  it("ships only the allowed files", () => {
    for (const f of [
      "PLAN.md",
      "VerseLayout.tsx",
      "verse.css",
      "theme.ts",
      "i18n.ts",
    ]) {
      expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
    }
  });

  it("exports VerseLayout({ brand }) and does not use SkinHead / TabNav", () => {
    const tsx = read("VerseLayout.tsx");
    expect(tsx).toMatch(/export function VerseLayout\(\{\s*brand\s*\}:\s*\{\s*brand:\s*string\s*\}\)/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/from ["'].*layouts\//);
  });

  it("uses LyricsView panel plus allowed library surfaces", () => {
    const tsx = read("VerseLayout.tsx");
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/variant=["']panel["']/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/CoverImg/);
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/togglePlay/);
    expect(tsx).toMatch(/next\(/);
  });

  it("does not add comments, social, video, or VIP", () => {
    const blob = ["VerseLayout.tsx", "verse.css", "theme.ts", "i18n.ts", "PLAN.md"]
      .map(read)
      .join("\n");
    expect(blob).not.toMatch(/\b(comment-thread|social-feed|video-player|vip-gate)\b/i);
    expect(read("VerseLayout.tsx")).not.toMatch(/\bVIP\b/);
    expect(read("VerseLayout.tsx")).not.toMatch(/comment/i);
    expect(read("VerseLayout.tsx")).not.toMatch(/\bsocial\b/i);
    expect(read("VerseLayout.tsx")).not.toMatch(/\bvideo\b/i);
  });

  it("registers verse-dim and verse-deep with layout verse", () => {
    expect(VERSE_LAYOUT).toBe("verse");
    expect(verseDim.id).toBe("verse-dim");
    expect(verseDeep.id).toBe("verse-deep");
    expect(verseDim.layout).toBe("verse");
    expect(verseDeep.layout).toBe("verse");
    expect(VERSE_THEMES.map((t) => t.id)).toEqual(["verse-dim", "verse-deep"]);
    expect(getVerseTheme("verse-dim")?.nameEn).toBe("Verse Dim");
    expect(getVerseTheme("verse-deep")?.nameEn).toBe("Verse Deep");
    expect(verseDim.accent).toMatch(/^#/);
    expect(verseDeep.accent).toMatch(/^#/);
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(verseDim.bg)).toBeLessThan(40);
    expect(lum(verseDeep.bg)).toBeLessThan(lum(verseDim.bg));
  });

  it("css covers 720px+, 44px controls, dvh and safe-area", () => {
    const css = read("verse.css");
    expect(css.includes("720px")).toBe(true);
    expect(css).toMatch(/min-width:\s*720px/);
    expect(css).toMatch(/max-width:\s*720px/);
    expect(css).toMatch(/min-width:\s*44px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/verse-dim/);
    expect(css).toMatch(/verse-deep/);
  });

  it("keeps lyrics filling leftover height and unifies dock controls", () => {
    const css = read("verse.css");
    const tsx = read("VerseLayout.tsx");
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(css).toMatch(/\.verse-lyrics[\s\S]*min-height:\s*0/);
    expect(css).toMatch(/overflow-y:\s*auto/);
    expect(css).toMatch(/\.verse-ctrl,\s*\n\s*\.verse-ctrl--play/);
    expect(css).not.toMatch(/verse-ctrl--play[^{]*\{[^}]*52px/);
    expect(css).toMatch(/grid-template-areas:[\s\S]*"art meta ctrls"/);
    expect(css).toMatch(/safe-area-inset-bottom/);
  });

  it("i18n has matching zh and en chrome strings", () => {
    expect(Object.keys(verseI18n.zh).sort()).toEqual(Object.keys(verseI18n.en).sort());
    expect(verseT("zh", "closeSheet")).toBeTruthy();
    expect(verseT("en", "closeSheet")).toMatch(/lyrics/i);
    expect(verseT("en", "leafFavorites")).toBe("Liked");
  });
});
