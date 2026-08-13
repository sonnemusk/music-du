import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BOARDS_LAYOUT,
  BOARDS_THEME_IDS,
  BOARDS_THEMES,
  getBoardsTheme,
} from "../client/src/skins/experiences/boards/theme.js";
import { boardsDict, boardsT } from "../client/src/skins/experiences/boards/i18n.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/boards");
const tsx = fs.readFileSync(path.join(dir, "BoardsLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(dir, "boards.css"), "utf8");
const plan = fs.readFileSync(path.join(dir, "PLAN.md"), "utf8");

describe("boards experience", () => {
  it("ships the allowed files only", () => {
    const names = fs.readdirSync(dir).sort();
    expect(names).toEqual([
      "BoardsLayout.tsx",
      "PLAN.md",
      "boards.css",
      "i18n.ts",
      "theme.ts",
    ]);
    expect(tsx).toMatch(/export function BoardsLayout\(\{ brand \}/);
  });

  it("does not use SkinHead or TabNav chrome", () => {
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/from ["'].*layouts\//);
    expect(tsx).not.toMatch(/recommend|为你推荐|vip|VIP/i);
    expect(plan.length).toBeGreaterThan(200);
  });

  it("lands on ChartsPanel via setTab charts", () => {
    expect(tsx).toMatch(/setTab\("charts"\)/);
    expect(tsx).toMatch(/<ChartsPanel/);
    expect(tsx).toMatch(/<TrackList/);
    expect(tsx).toMatch(/<Transport/);
    expect(tsx).toMatch(/<SearchBar/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/<SkinSwitcher/);
    expect(tsx).toMatch(/<LocaleSwitcher/);
    expect(tsx).toMatch(/<LyricsView/);
    expect(tsx).toMatch(/<CoverImg/);
    expect(tsx).toMatch(/usePlayer/);
  });

  it("CSS covers desktop 720px+ and 44px targets", () => {
    expect(css).toMatch(/720px/);
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).not.toMatch(/@media \(min-width:\s*720px\)/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset/);
    expect(css).toMatch(/44px/);
    expect(css).toMatch(/\.charts-chip/);
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/min-width:\s*44px/);
  });

  it("exports boards-dim and boards-deep with layout boards", () => {
    expect(BOARDS_LAYOUT).toBe("boards");
    expect([...BOARDS_THEME_IDS]).toEqual(["boards-dim", "boards-deep"]);
    expect(BOARDS_THEMES.map((t) => t.id)).toEqual(["boards-dim", "boards-deep"]);
    for (const t of BOARDS_THEMES) {
      expect(t.layout).toBe("boards");
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(t.accent).toMatch(/^#/);
      expect(t.bg).toMatch(/^#/);
    }
    expect(getBoardsTheme("boards-dim").id).toBe("boards-dim");
    expect(getBoardsTheme("boards-deep").id).toBe("boards-deep");
    const dimLum = luminance(getBoardsTheme("boards-dim").bg);
    const deepLum = luminance(getBoardsTheme("boards-deep").bg);
    expect(dimLum).toBeLessThan(50);
    expect(deepLum).toBeLessThan(dimLum);
  });

  it("local i18n covers both locales without editing zh/en catalogs", () => {
    expect(boardsT("zh", "wordmark")).toBe(boardsDict.zh.wordmark);
    expect(boardsT("en", "wordmark")).toBe(boardsDict.en.wordmark);
    expect(boardsT("en", "kicker")).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}
