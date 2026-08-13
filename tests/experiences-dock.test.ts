import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAYOUT_ID,
  LAYOUT_META,
  THEMES,
} from "../client/src/skins/experiences/dock/theme.js";
import { dockEn, dockZh } from "../client/src/skins/experiences/dock/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockDir = path.join(root, "client/src/skins/experiences/dock");

function read(name: string): string {
  return fs.readFileSync(path.join(dockDir, name), "utf8");
}

describe("dock experience", () => {
  it("DockLayout.tsx exists and does not import SkinHead", () => {
    const tsxPath = path.join(dockDir, "DockLayout.tsx");
    expect(fs.existsSync(tsxPath)).toBe(true);
    const tsx = read("DockLayout.tsx");
    expect(tsx).toMatch(/export function DockLayout/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/SideLayout|ImmersiveLayout|CompactLayout|GalleryLayout/);
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("CSS contains 720px and a second breakpoint (1024px)", () => {
    const css = read("dock.css");
    expect(css.includes("720px")).toBe(true);
    expect(css.includes("1024px")).toBe(true);
    expect(css).toMatch(/100dvh/);
  });

  it("exports two unique dock themes with layout dock", () => {
    expect(LAYOUT_ID).toBe("dock");
    expect(THEMES.length).toBe(2);
    const ids = THEMES.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(["dock-dim", "dock-deep"]));
    expect(new Set(ids).size).toBe(2);
    for (const theme of THEMES) {
      expect(theme.layout).toBe("dock");
      expect(theme.nameEn.length).toBeGreaterThan(0);
      expect(theme.taglineEn.length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fff]/.test(theme.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(theme.taglineEn)).toBe(false);
      expect(theme.bg).toMatch(/^#/);
    }
    expect(LAYOUT_META.dock).toBeTruthy();
  });

  it("dim vs deep backgrounds are different hexes", () => {
    const dim = THEMES.find((t) => t.id === "dock-dim");
    const deep = THEMES.find((t) => t.id === "dock-deep");
    expect(dim).toBeTruthy();
    expect(deep).toBeTruthy();
    expect(dim!.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(deep!.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(dim!.bg.toLowerCase()).not.toBe(deep!.bg.toLowerCase());
  });

  it("min 44px rules exist for primary buttons / mini play", () => {
    const css = read("dock.css");
    expect(css).toMatch(/\.dock-mini__play[\s\S]{0,180}min-(width|height):\s*44px/);
    expect(css).toMatch(/\.dock-mini__skip[\s\S]{0,160}min-(width|height):\s*44px/);
    expect(css).toMatch(/pointer:\s*coarse/);
    expect(css).toMatch(/min-width:\s*44px/);
    expect(css).toMatch(/min-height:\s*44px/);
  });

  it("player sheet stacks below search overlay (900) and theme panel (2000)", () => {
    const css = read("dock.css");
    expect(css).toMatch(/--dock-sheet-z:\s*80/);
    const tsx = read("DockLayout.tsx");
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SearchBar/);
  });

  it("shell i18n ships matching zh/en keys and English has no CJK", () => {
    const walk = (obj: unknown, prefix = ""): string[] => {
      if (!obj || typeof obj !== "object") return prefix ? [prefix] : [];
      const out: string[] = [];
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object") out.push(...walk(v, p));
        else out.push(p);
      }
      return out;
    };
    expect(walk(dockZh).sort()).toEqual(walk(dockEn).sort());
    const dump = JSON.stringify(dockEn);
    expect(/[\u4e00-\u9fff]/.test(dump)).toBe(false);
  });
});
