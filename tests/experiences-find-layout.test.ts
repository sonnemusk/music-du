import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FIND_THEMES } from "../client/src/skins/experiences/find/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/find");

const tsx = fs.readFileSync(path.join(dir, "FindLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(dir, "find.css"), "utf8");

function media(src: string, query: string): string {
  const re = new RegExp(`@media \\(${query}\\)\\s*\\{`);
  const m = src.match(re);
  if (!m || m.index === undefined) return "";
  let i = m.index + m[0].length;
  let depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "{") depth += 1;
    else if (src[i] === "}") depth -= 1;
    i += 1;
  }
  return src.slice(m.index, i);
}

const phone = media(css, "max-width:\\s*720px");
const desktop = media(css, "min-width:\\s*721px");

describe("find e2e layout — search-first", () => {
  it("mounts setTab search and keeps SearchBar in the hero", () => {
    expect(tsx).toMatch(/setTab\("search"\)/);
    expect(tsx).toMatch(/className="find-hero"/);
    expect(tsx).toMatch(/<SearchBar className="find-search skin-search"/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/tab === ["']search["'][\s\S]{0,80}<SearchBar/);
  });

  it("does not hide the hero SearchBar on phone (search-first exception)", () => {
    expect(phone.length).toBeGreaterThan(80);
    expect(phone).not.toMatch(/\.find-search\s*\{[^}]*display:\s*none/);
    expect(phone).not.toMatch(/\.find-hero\s*\{[^}]*display:\s*none/);
    expect(phone).toMatch(/\.find-search[\s\S]*display:\s*flex/);
    expect(css).toMatch(/Search-first: hero SearchBar stays on phone and desktop/);
  });

  it("uses 16px input at ≤720px and 720px / 721px viewports", () => {
    expect(css).toMatch(/720px/);
    expect(css).toMatch(/min-width:\s*721px/);
    expect(phone).toMatch(/\.find-search input[\s\S]*?font-size:\s*16px/);
    expect(phone).not.toMatch(/\.find-search input[\s\S]*?font-size:\s*1[0-5]px/);
    expect(css).toMatch(/\.layout-find \.find-search input\s*\{[\s\S]*?font-size:\s*16px/);
  });

  it("aligns submit with the input on the same stretched row", () => {
    expect(css).toMatch(/\.find-well\s*\{[\s\S]*?align-items:\s*stretch/);
    expect(css).toMatch(/\.find-well\s*\{[\s\S]*?height:\s*var\(--find-search-h\)/);
    expect(css).toMatch(/\.find-search\s*,[\s\S]*?align-items:\s*stretch/);
    expect(css).toMatch(/\.find-search button\s*\{[\s\S]*?height:\s*100%/);
    expect(css).toMatch(/\.find-search input\s*\{[\s\S]*?height:\s*100%/);
    expect(css).toMatch(/--find-search-h:\s*48px/);
    expect(desktop).toMatch(/--find-search-h:\s*52px/);
  });

  it("keeps mini prev / play / next at the same ≥44×44 size", () => {
    expect(css).toMatch(
      /\.find-mini \.t-btn:not\(\.ghost\),\s*\.layout-find \.find-mini \.t-btn\.play\s*\{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/
    );
    expect(phone).toMatch(/min-width:\s*44px/);
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(css).not.toMatch(/\.find-mini \.t-btn\.play\s*\{[^}]*min-(width|height):\s*4[89]px/);
  });

  it("wraps fallback chips at ≥36px (likes / history / charts / playlist / lyrics)", () => {
    expect(tsx).toMatch(/\["favorites", "history", "charts", "playlist", "lyrics"\]/);
    expect(css).toMatch(/\.find-drawers\s*\{[\s\S]*?flex-wrap:\s*wrap/);
    expect(css).toMatch(/\.find-chip\s*\{[\s\S]*?min-height:\s*36px/);
    const chip = css.match(/\.find-chip\s*\{([^}]+)\}/);
    expect(chip?.[1]).toMatch(/min-height:\s*36px/);
    const h = Number(chip?.[1].match(/min-height:\s*(\d+)px/)?.[1] || 0);
    expect(h).toBeGreaterThanOrEqual(36);
  });

  it("reserves hero search height so empty / results do not jump", () => {
    expect(css).toMatch(/\.find-hero\s*,[\s\S]*?flex:\s*0 0 auto/);
    expect(css).toMatch(/\.find-status\s*\{[\s\S]*?min-height:\s*44px/);
    expect(css).toMatch(/\.find-status\s*\{[\s\S]*?height:\s*44px/);
    expect(css).toMatch(/\.find-status-copy\s*\{[\s\S]*?white-space:\s*nowrap/);
    expect(css).toMatch(/\.find-kicker\s*\{[\s\S]*?white-space:\s*nowrap/);
    expect(tsx).toMatch(/find-status/);
  });

  it("clips overflow across 390–1280 (hidden + min-width 0 + 100%)", () => {
    expect(css).toMatch(/\.layout-find\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(css).toMatch(/overflow-x:\s*hidden/);
    expect(css).toMatch(/max-width:\s*100%/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/100dvh/);
    expect(css).toMatch(/safe-area-inset/);
  });

  it("paints both find-dim and find-deep", () => {
    expect(FIND_THEMES.map((t) => t.id)).toEqual(["find-dim", "find-deep"]);
    expect(css).toMatch(/\[data-find="find-dim"\]/);
    expect(css).toMatch(/\[data-find="find-deep"\]/);
  });
});
