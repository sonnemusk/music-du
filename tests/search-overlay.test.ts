import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { en } from "../client/src/i18n/en.js";
import { zh } from "../client/src/i18n/zh.js";
import { setLocaleModule, t } from "../client/src/i18n/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const layouts = [
  "client/src/skins/layouts/shared.tsx",
  "client/src/skins/experiences/stage/StageLayout.tsx",
  "client/src/skins/experiences/verse/VerseLayout.tsx",
  "client/src/skins/experiences/split/SplitLayout.tsx",
  "client/src/skins/experiences/recent/RecentLayout.tsx",
  "client/src/skins/experiences/dock/DockLayout.tsx",
  "client/src/skins/experiences/desk/DeskLayout.tsx",
  "client/src/skins/experiences/feed/FeedLayout.tsx",
  "client/src/skins/experiences/find/FindLayout.tsx",
  "client/src/skins/experiences/likes/LikesLayout.tsx",
  "client/src/skins/experiences/boards/BoardsLayout.tsx",
];

describe("lazy SearchOverlay", () => {
  const app = read("client/src/App.tsx");
  const overlay = read("client/src/components/SearchOverlay.tsx");
  const gesture = read("client/src/lib/search-gesture.ts");
  const css = read("client/src/skins/layouts/layouts.css");

  it("lazy-loads the overlay from App and does not statically import it", () => {
    expect(app).toMatch(/const SearchOverlay = lazy\(/);
    expect(app).toMatch(/import\("\.\/components\/SearchOverlay"\)/);
    expect(app).not.toMatch(/import\s*\{[^}]*SearchOverlay/);
    expect(app).toMatch(/searchLayerOnce \|\| \(searchOpen && mobileSearch\)/);
  });

  it("keeps layouts off the overlay module so lazy chunks stay split", () => {
    for (const rel of layouts) {
      const src = read(rel);
      expect(src, rel).toMatch(/from ["'][^"']*search-gesture["']/);
      expect(src, rel).not.toMatch(/from ["'][^"']*SearchOverlay["']/);
      expect(src, rel).toMatch(/preloadSearchOverlay/);
    }
  });

  it("preloads the overlay chunk in-gesture before flushSync open", () => {
    expect(gesture).toMatch(/export function preloadSearchOverlay/);
    expect(gesture).toMatch(/import\("\.\.\/components\/SearchOverlay"\)/);
    expect(gesture).toMatch(/flushSync/);
    expect(gesture).toMatch(/openSearchOverlay/);
  });

  it("announces result count in a visually hidden live region", () => {
    expect(overlay).toMatch(/aria-live="polite"/);
    expect(overlay).toMatch(/search\.resultsLive/);
    expect(css).toMatch(/\.search-overlay__live\s*\{/);
    expect(css).toMatch(/clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
    expect(String((zh as { search: { resultsLive: string } }).search.resultsLive)).toBe(
      "{n} 条结果"
    );
    expect(String((en as { search: { resultsLive: string } }).search.resultsLive)).toBe(
      "{n} results"
    );
    setLocaleModule("zh");
    expect(t("search.resultsLive", { n: 4 })).toBe("4 条结果");
    setLocaleModule("en");
    expect(t("search.resultsLive", { n: 4 })).toBe("4 results");
    setLocaleModule("zh");
  });
});
