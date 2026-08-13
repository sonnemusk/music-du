import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BOARDS_THEME_IDS,
  BOARDS_THEMES,
} from "../client/src/skins/experiences/boards/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "client/src/skins/experiences/boards");
const tsx = fs.readFileSync(path.join(dir, "BoardsLayout.tsx"), "utf8");
const css = fs.readFileSync(path.join(dir, "boards.css"), "utf8");

describe("boards e2e layout polish", () => {
  it("mounts ChartsPanel via setTab charts and skips SkinHead", () => {
    expect(tsx).toMatch(/setTab\("charts"\)/);
    expect(tsx).toMatch(/<ChartsPanel/);
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).toMatch(/boards-mast__end/);
    expect(tsx).toMatch(/boards-dest__plate/);
    expect(tsx).toMatch(/boards-mini/);
    expect(tsx).toMatch(/className=\{`boards-mini player-bar/);
  });

  it("splits phone/desktop at 720 without overlapping both queries", () => {
    expect(css).toMatch(/@media \(min-width:\s*721px\)/);
    expect(css).toMatch(/@media \(max-width:\s*720px\)/);
    expect(css).not.toMatch(/@media \(min-width:\s*720px\)/);
    expect(css).not.toMatch(/@media \(max-width:\s*721px\)/);
    const phone = css.match(/@media \(max-width:\s*720px\)\s*\{[\s\S]*?\n\}/)?.[0] || "";
    expect(phone).toMatch(/flex-wrap:\s*nowrap/);
    expect(phone).toMatch(/\.charts-chip/);
  });

  it("keeps ChartsPanel chips tappable and uncramped", () => {
    expect(css).toMatch(
      /\.layout-boards \.charts-chip,\s*\.layout-boards \.charts-chip--board\s*\{[^}]*min-height:\s*44px/s
    );
    expect(css).toMatch(
      /\.layout-boards \.charts-chip,\s*\.layout-boards \.charts-chip--board\s*\{[^}]*min-width:\s*44px/s
    );
    expect(css).toMatch(
      /\.layout-boards \.charts-chip,\s*\.layout-boards \.charts-chip--board\s*\{[^}]*white-space:\s*nowrap/s
    );
    expect(css).toMatch(
      /\.layout-boards \.charts-chip,\s*\.layout-boards \.charts-chip--board\s*\{[^}]*flex-shrink:\s*0/s
    );
    expect(css).toMatch(
      /\.layout-boards \.charts-chip,\s*\.layout-boards \.charts-chip--board\s*\{[^}]*writing-mode:\s*horizontal-tb/s
    );
    expect(css).toMatch(/@media \(pointer:\s*coarse\)[\s\S]*\.charts-chip[\s\S]*min-height:\s*44px/);
  });

  it("keeps mini ticker prev/play/next at least 44px over the idle 36px rule", () => {
    expect(css).toMatch(
      /\.layout-boards \.boards-mini \.t-btn:not\(\.ghost\)\s*\{[^}]*min-width:\s*44px/s
    );
    expect(css).toMatch(
      /\.layout-boards \.boards-mini \.t-btn:not\(\.ghost\)\s*\{[^}]*min-height:\s*44px/s
    );
    expect(css).toMatch(
      /\.skin-host\[data-idle="1"\] \.layout-boards \.boards-mini \.t-btn:not\(\.ghost\)/
    );
    expect(css).toMatch(
      /\.layout-boards \.boards-mini \.t-btn\.play\s*\{[^}]*min-width:\s*52px/s
    );
    expect(css).not.toMatch(/\.boards-mini[\s\S]{0,240}width:\s*36px/);
    expect(css).toMatch(/\.layout-boards \.boards-mini \.transport-row[\s\S]*flex-wrap:\s*nowrap/);
    expect(css).toMatch(
      /\.layout-boards \.boards-mini\.player-bar[\s\S]*grid-template-columns:\s*52px minmax\(0,\s*1fr\) minmax\(/
    );
  });

  it("aligns dest plates, desktop SearchBar, and phone overlay at 44px", () => {
    expect(css).toMatch(/\.boards-dest\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.boards-dest__plate\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.boards-dest__plate\s*\{[^}]*height:\s*44px/s);
    expect(css).toMatch(/\.boards-mast__end\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.boards-search\s*\{[^}]*height:\s*44px/s);
    expect(css).toMatch(/\.boards-mast__tools\s*\{[^}]*height:\s*44px/s);
    expect(css).toMatch(/\.boards-search-launch\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(
      /:root:has\(\.layout-boards\) \.search-overlay__input[\s\S]*min-height:\s*44px/
    );
    expect(css).toMatch(/--search-overlay-bottom:\s*calc\(160px/);
  });

  it("aligns chart rows without overlap and clips 390–1280 overflow", () => {
    expect(css).toMatch(/\.layout-boards \.track-row\s*\{[^}]*align-items:\s*center/s);
    expect(css).toMatch(/\.layout-boards \.track-rank\s*\{[^}]*flex:\s*0 0 36px/s);
    expect(css).toMatch(/\.layout-boards \.track-row \.cov\s*\{[^}]*width:\s*44px/s);
    expect(css).toMatch(/\.layout-boards \.track-meta\s*\{[^}]*min-width:\s*0/s);
    expect(css).toMatch(/\.layout-boards \.track-acts\s*\{[^}]*flex:\s*0 0 auto/s);
    expect(css).toMatch(/\.layout-boards\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.boards-stage\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).toMatch(/\.layout-boards \.icon-btn\s*\{[^}]*min-width:\s*44px/s);
  });

  it("ships both palettes on layout boards", () => {
    expect([...BOARDS_THEME_IDS]).toEqual(["boards-dim", "boards-deep"]);
    expect(BOARDS_THEMES.map((t) => t.id)).toEqual(["boards-dim", "boards-deep"]);
    expect(BOARDS_THEMES.every((t) => t.layout === "boards")).toBe(true);
    expect(css).toMatch(/data-skin="boards-dim"/);
    expect(css).toMatch(/data-skin="boards-deep"/);
    expect(css).toMatch(/data-palette="deep"/);
  });
});
