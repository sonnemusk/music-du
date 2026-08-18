import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAYOUT_ID,
  LAYOUT_META,
  THEMES,
} from "../client/src/skins/experiences/desk/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/desk");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("desk experience", () => {
  it("ships only the allowed files", () => {
    for (const name of ["PLAN.md", "DeskLayout.tsx", "desk.css", "theme.ts", "i18n.ts"]) {
      expect(fs.existsSync(path.join(dir, name)), name).toBe(true);
    }
    expect(fs.existsSync(path.join(root, "tests/experiences-desk.test.ts"))).toBe(true);
  });

  it("exports DeskLayout and does not import shared layout chrome", () => {
    const tsx = read("DeskLayout.tsx");
    expect(tsx).toMatch(/export function DeskLayout\(\{\s*brand\s*\}/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/SideLayout|ImmersiveLayout|CompactLayout|GalleryLayout/);
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/usePlayer/);
    expect(tsx).toMatch(/TrackList/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/CoverImg/);
  });

  it("CSS has 720px and 1024px breakpoints and 44px play / prev / next", () => {
    const css = read("desk.css");
    expect(css.includes("720px")).toBe(true);
    expect(css.includes("1024px")).toBe(true);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(max-width:\s*1024px\)/);
    expect(css).toMatch(/@media \(min-width:\s*1025px\)/);
    expect(css).toMatch(/\.desk-play[\s\S]{0,220}min-width:\s*44px/);
    expect(css).toMatch(/\.desk-prev[\s\S]{0,220}min-width:\s*44px/);
    expect(css).toMatch(/\.desk-next[\s\S]{0,220}min-width:\s*44px/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/font-size:\s*16px/);
  });

  it("defines two desk themes with distinct dark backgrounds", () => {
    expect(LAYOUT_ID).toBe("desk");
    expect(THEMES).toHaveLength(2);
    const ids = THEMES.map((t) => t.id).sort();
    expect(ids).toEqual(["desk-deep", "desk-dim"]);
    expect(THEMES.every((t) => t.layout === "desk")).toBe(true);
    const dim = THEMES.find((t) => t.id === "desk-dim")!;
    const deep = THEMES.find((t) => t.id === "desk-deep")!;
    expect(dim.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(deep.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(dim.bg.toLowerCase()).not.toBe(deep.bg.toLowerCase());
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(dim.bg)).toBeLessThan(80);
    expect(lum(deep.bg)).toBeLessThan(80);
    expect(LAYOUT_META.name.length).toBeGreaterThan(0);
    expect(LAYOUT_META.nameEn.length).toBeGreaterThan(0);
    expect(LAYOUT_META.blurb.length).toBeGreaterThan(0);
    expect(LAYOUT_META.blurbEn.length).toBeGreaterThan(0);
    expect(/[\u4e00-\u9fff]/.test(LAYOUT_META.nameEn)).toBe(false);
    expect(/[\u4e00-\u9fff]/.test(LAYOUT_META.blurbEn)).toBe(false);
  });

  it("keeps play / prev / next on both desktop dock and phone mini bar", () => {
    const tsx = read("DeskLayout.tsx");
    expect(tsx).toMatch(/desk-prev/);
    expect(tsx).toMatch(/desk-play/);
    expect(tsx).toMatch(/desk-next/);
    expect(tsx).toMatch(/next\(-1\)/);
    expect(tsx).toMatch(/next\(1\)/);
    expect(tsx).toMatch(/togglePlay/);
    expect(tsx).toMatch(/<Transport/);
    expect(tsx).toMatch(/compact/);
    expect(tsx).toMatch(/desk-dock/);
    expect(tsx).toMatch(/desk-mini/);
    expect(tsx).toMatch(/desk-foot/);
  });
});
