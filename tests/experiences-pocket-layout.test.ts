import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  POCKET_THEMES,
  pocketInk,
  pocketPaper,
  pocketThemeToCssVars,
} from "../client/src/skins/experiences/pocket/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/pocket");

function read(name: string) {
  return fs.readFileSync(path.join(dir, name), "utf8");
}

const tsx = read("PocketLayout.tsx");
const css = read("pocket.css");

function decl(selector: string): string {
  const needle = `${selector} {`;
  const i = css.indexOf(needle);
  if (i < 0) return "";
  const start = i + needle.length;
  const end = css.indexOf("}", start);
  return end < 0 ? "" : css.slice(start, end);
}

describe("pocket e2e layout — lyrics stay on the stage", () => {
  it("uses LyricsView panel inside a min-height-0 scroller", () => {
    expect(tsx).toMatch(/<LyricsView variant=["']panel["']\s*\/>/);
    expect(tsx).toMatch(/className="pocket-verse"/);
    expect(decl(".pocket-verse")).toMatch(/min-height:\s*0/);
    expect(css).toMatch(/\.pocket \.lyrics-panel\.lyrics-scroller[\s\S]{0,180}min-height:\s*0\s*!important/);
  });

  it("flips cover and lyrics in-page with no dialog chrome", () => {
    expect(tsx).toMatch(/role="tablist"/);
    expect(tsx).toMatch(/className="pocket-faces"/);
    expect(tsx).toMatch(/data-face=\{face\}/);
    expect(tsx).not.toMatch(/role=["']dialog["']/);
    expect(tsx).not.toMatch(/pocket-sheet|pocket-close/);
    expect(css).not.toMatch(/position:\s*fixed[\s\S]{0,80}z-index:\s*[1-9]/);
  });

  it("charts library does not repeat the Charts heading", () => {
    expect(css).toMatch(
      /\.pocket-library:has\(\.charts-panel\) \.pocket-library__title\s*\{[^}]*display:\s*none/s
    );
  });
});

describe("pocket e2e layout — mini + tabs", () => {
  it("keeps mini prev/play/next at 44px", () => {
    expect(tsx).toMatch(/data-pocket-ctrl="prev"/);
    expect(tsx).toMatch(/data-pocket-ctrl="play"/);
    expect(tsx).toMatch(/data-pocket-ctrl="next"/);
    expect(css).toMatch(/--pocket-hit:\s*44px/);
    expect(css).toMatch(/\.pocket-mini__btn,\s*\n\s*\.pocket-mini__btn\.play/);
    expect(css).toMatch(
      /\.pocket-mini__btn,\s*\n\s*\.pocket-mini__btn\.play\s*\{[\s\S]*?min-width:\s*var\(--pocket-hit\)/
    );
    expect(css).toMatch(
      /\.pocket-mini__btn,\s*\n\s*\.pocket-mini__btn\.play\s*\{[\s\S]*?min-height:\s*var\(--pocket-hit\)/
    );
    expect(tsx).toMatch(/className="pocket-mini player-bar"/);
  });

  it("uses a 5-col now / queue / likes / charts / history rail", () => {
    expect(tsx).toMatch(/\["now", "playlist", "favorites", "charts", "history"\]/);
    expect(css).toMatch(/grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.pocket-tab[\s\S]{0,180}min-width:\s*var\(--pocket-hit\)/);
  });
});

describe("pocket e2e layout — overflow + palettes", () => {
  it("locks the shell and splits at 720px", () => {
    expect(decl(".pocket")).toMatch(/overflow:\s*hidden/);
    expect(decl(".pocket")).toMatch(/height:\s*100%/);
    expect(css.includes("720px")).toBe(true);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
  });

  it("ships pocket-paper and pocket-ink as two distinct palettes", () => {
    expect(pocketPaper.id).toBe("pocket-paper");
    expect(pocketInk.id).toBe("pocket-ink");
    expect(POCKET_THEMES).toHaveLength(2);
    expect(pocketThemeToCssVars(pocketPaper)["--bg"]).not.toBe(
      pocketThemeToCssVars(pocketInk)["--bg"]
    );
    expect(tsx).toMatch(/setSkin\("pocket-paper"\)/);
    expect(tsx).toMatch(/setSkin\("pocket-ink"\)/);
  });

  it("sizes the search overlay from the live tab / mini height", () => {
    expect(tsx).toMatch(/ResizeObserver/);
    expect(tsx).toMatch(/--search-overlay-bottom/);
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
  });
});
