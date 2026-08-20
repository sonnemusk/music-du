import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { pocketI18n, pocketT } from "../client/src/skins/experiences/pocket/i18n.js";
import {
  DEFAULT_POCKET_THEME,
  POCKET_LAYOUT,
  POCKET_THEME_IDS,
  POCKET_THEMES,
  getPocketTheme,
  isPocketThemeId,
  pocketInk,
  pocketPaper,
  pocketThemeToCssVars,
} from "../client/src/skins/experiences/pocket/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/pocket");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

describe("pocket experience files", () => {
  it("ships only the allowed experience files", () => {
    for (const f of ["PLAN.md", "PocketLayout.tsx", "pocket.css", "theme.ts", "i18n.ts"]) {
      expect(fs.existsSync(path.join(dir, f)), f).toBe(true);
    }
  });
});

describe("pocket layout contract", () => {
  const tsx = read("PocketLayout.tsx");

  it("exports PocketLayout({ brand }) and opens on now-playing", () => {
    expect(tsx).toMatch(/export function PocketLayout\(\{\s*brand\s*\}/);
    expect(tsx).toMatch(/useState<PocketPage>\("now"\)/);
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
    expect(tsx).toMatch(/Transport/);
    expect(tsx).toMatch(/SearchBar/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/CoverImg/);
  });

  it("keeps lyrics on the now-playing page instead of a closeable sheet", () => {
    expect(tsx).toMatch(/setFace\("lyrics"\)/);
    expect(tsx).toMatch(/setFace\("cover"\)/);
    expect(tsx).toMatch(/className="pocket-verse"/);
    expect(tsx).not.toMatch(/role=["']dialog["']/);
    expect(tsx).not.toMatch(/closeSheet|sheetClose|__close/);
    expect(tsx).not.toMatch(/comment|social|video|VIP|daily.?recommend/i);
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("pocket css", () => {
  const css = read("pocket.css");

  it("splits desktop and phone at 720px+", () => {
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
    expect(css).toMatch(/@media \(max-width:\s*390px\)/);
  });

  it("meets 44px touch targets, height lock, and safe-area", () => {
    expect(css).toMatch(/--pocket-hit:\s*44px/);
    expect(css).toMatch(/min-width:\s*var\(--pocket-hit\)/);
    expect(css).toMatch(/min-height:\s*var\(--pocket-hit\)/);
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/overflow:\s*hidden/);
    expect(css).toMatch(/font-size:\s*16px/);
  });

  it("does not park lyrics in a fixed overlay", () => {
    expect(css).not.toMatch(/\.pocket-verse\s*\{[^}]*position:\s*fixed/s);
    expect(css).not.toMatch(/\.pocket-verse\s*\{[^}]*position:\s*absolute/s);
    expect(css).toMatch(/\.pocket-verse[\s\S]{0,80}min-height:\s*0/);
    expect(css).toMatch(/data-face="lyrics"/);
    expect(css).toMatch(/data-pocket="pocket-paper"/);
    expect(css).toMatch(/data-pocket="pocket-ink"/);
  });
});

describe("pocket-paper / pocket-ink", () => {
  it("exports both palettes on layout pocket", () => {
    expect(POCKET_LAYOUT).toBe("pocket");
    expect(POCKET_THEME_IDS).toEqual(["pocket-paper", "pocket-ink"]);
    expect(DEFAULT_POCKET_THEME).toBe("pocket-paper");
    expect(isPocketThemeId("pocket-paper")).toBe(true);
    expect(isPocketThemeId("pocket-ink")).toBe(true);
    expect(pocketPaper.layout).toBe("pocket");
    expect(pocketInk.layout).toBe("pocket");
  });

  it("paper is light and ink is dark", () => {
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(pocketPaper.bg)).toBeGreaterThan(160);
    expect(lum(pocketInk.bg)).toBeLessThan(50);
    expect(pocketPaper.accent).not.toBe(pocketInk.accent);
    for (const t of POCKET_THEMES) {
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(t.taglineEn)).toBe(false);
      const vars = pocketThemeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
      expect(vars["--wallpaper"]).toBeTruthy();
    }
    expect(getPocketTheme("pocket-ink").id).toBe("pocket-ink");
  });
});

describe("pocket i18n", () => {
  it("covers zh and en chrome copy", () => {
    expect(pocketI18n.zh.faceLyrics).toBeTruthy();
    expect(pocketI18n.en.faceLyrics).toMatch(/lyric/i);
    expect(pocketT("zh", "faceCover")).toBe(pocketI18n.zh.faceCover);
    expect(pocketT("en", "tab.now")).toBe(pocketI18n.en.tab.now);
    expect(pocketT("en", "flipHint")).toMatch(/cover/i);
  });
});
