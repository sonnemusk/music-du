import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layouts = fs.readFileSync(
  path.join(root, "client/src/skins/layouts/layouts.css"),
  "utf8"
);
const shared = fs.readFileSync(
  path.join(root, "client/src/skins/layouts/shared.tsx"),
  "utf8"
);
const app = fs.readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
const switcher = fs.readFileSync(
  path.join(root, "client/src/components/SkinSwitcher.tsx"),
  "utf8"
);

const layoutFiles = [
  "SideLayout.tsx",
  "ImmersiveLayout.tsx",
  "CompactLayout.tsx",
  "GalleryLayout.tsx",
];

describe("cross-layout chrome consistency", () => {
  it("no separate app-chrome bar", () => {
    expect(app).not.toMatch(/app-chrome/);
    expect(app).not.toMatch(/SkinSwitcher/);
  });

  it("narrow-window compress does not hide volume on experience skins", () => {
    const css = fs.readFileSync(
      path.join(root, "client/src/skins/layouts/layouts.css"),
      "utf8"
    );
    const block = css.split("M-3: idle compress")[1] || "";
    expect(block).toMatch(/\.side-player \.vol-row/);
    expect(block).toMatch(/\.imm-now \.vol-row/);
    expect(block).not.toMatch(/\[data-idle="1"\] \.vol-row,/);
    expect(block).not.toMatch(/:not\(\[data-idle="1"\]\) \.vol-row \{/);
  });

  it("demo banner is dismissible and does not force 100dvh children off-screen", () => {
    const css = fs.readFileSync(
      path.join(root, "client/src/styles/global.css"),
      "utf8"
    );
    expect(app).toMatch(/demo-readonly-banner__close/);
    expect(app).toMatch(/data-demo-banner/);
    expect(app).toMatch(/isDemoSite && demoBanner/);
    expect(app).toMatch(/kazam\.v2\.demoBannerDismissed/);
    expect(css).toMatch(/\.app-shell \.skin-host > \*\s*\{[^}]*max-height:\s*100%/s);
    expect(css).toMatch(/\.app-shell \.skin-host > \*\s*\{[^}]*min-height:\s*0/s);
    expect(css).toMatch(/\.app-shell \.skin-host\s*\{[^}]*overflow:\s*hidden/s);
  });

  it("SkinHead owns brand + search + tools for shared layouts", () => {
    expect(shared).toMatch(/skin-head__main/);
    expect(shared).toMatch(/skin-head__tools/);
    expect(shared).toMatch(/SkinSwitcher/);
    expect(shared).toMatch(/function SkinHead/);
  });

  it("every layout uses SkinHead (single chrome contract)", () => {
    for (const f of layoutFiles) {
      const src = fs.readFileSync(
        path.join(root, "client/src/skins/layouts", f),
        "utf8"
      );
      expect(src.includes("SkinHead"), f).toBe(true);
    }
  });

  it("theme panel is portaled (not clipped by layout overflow)", () => {
    expect(switcher).toMatch(/createPortal/);
    expect(switcher).toMatch(/document\.body/);
    expect(switcher).toMatch(/function themePanelStyle/);
    expect(switcher).toMatch(/openAbove/);
    expect(switcher).toMatch(/preferLeft/);
  });

  it("search can shrink so tools never overflow head", () => {
    expect(layouts).toMatch(/\.skin-search\s*\{[^}]*min-width:\s*0/s);
    expect(layouts).toMatch(/\.skin-head__main\s*\{[^}]*display:\s*flex/s);
  });

  it("chrome tokens follow the active skin instead of hardcoded dark", () => {
    const css = fs.readFileSync(
      path.join(root, "client/src/styles/global.css"),
      "utf8"
    );
    const toast = css.match(/\.toast\s*\{[^}]+\}/)?.[0] || "";
    expect(toast).toMatch(/var\(--card/);
    expect(toast).toMatch(/var\(--fg/);
    expect(toast).toMatch(/var\(--line/);
    expect(toast).not.toMatch(/background:\s*#111/);
    expect(css).toMatch(/\.toast__action\s*\{[^}]*var\(--accent-fg/s);
    expect(css).toMatch(/\.cov\s*\{[^}]*var\(--card/s);
    expect(css).toMatch(/\.skin-panel__drawer-handle span\s*\{[^}]*var\(--fg/s);
    expect(css).toMatch(/\.skin-panel__close\s*\{[^}]*var\(--fg/s);
    expect(layouts).toMatch(/\.search-overlay__go\s*\{[^}]*var\(--accent-fg/s);
    expect(layouts).toMatch(/\.seek-track\[data-tip\]::after\s*\{[^}]*var\(--card/s);
    expect(layouts).not.toMatch(/\.search-overlay__go\s*\{[^}]*#1a1030/s);
  });

  it("transport controls meet touch-friendly sizes", () => {
    expect(layouts).toMatch(/\.t-btn\s*\{[^}]*min-width:\s*44px/s);
    expect(layouts).toMatch(/\.t-btn\.play\s*\{[^}]*56px/s);
  });
});
