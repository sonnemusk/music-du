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

  it("idle phones at 400px keep a play button on classic shells", () => {
    const phone = layouts.split("@media (max-width: 400px)")[1] || "";
    expect(phone).toMatch(/\.t-btn:not\(\.play\)/);
    expect(phone).toMatch(/\.t-btn\.play/);
    expect(phone).toMatch(/min-width:\s*44px/);
    expect(phone).not.toMatch(
      /\.side-player \.transport,\s*\n\s*\.skin-host\[data-idle="1"\] \.imm-now \.transport,\s*\n\s*\.skin-host\[data-idle="1"\] \.layout-compact \.player-bar__controls \{\s*display:\s*none/
    );
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

  it("debounces swipe-nav rebind when the shell mutates", () => {
    expect(app).toMatch(/MutationObserver/);
    expect(app).toMatch(/setTimeout\(bind,\s*80\)/);
    expect(app).toMatch(/if \(bindTimer\) clearTimeout\(bindTimer\)/);
  });

  it("binds vertical cover swipe on player-first covers, not the lyrics face", () => {
    expect(app).toMatch(/attachCoverSwipe/);
    expect(app).toMatch(/\.pocket-cover/);
    expect(app).toMatch(/\.stage-art/);
    expect(app).toMatch(/\.dock-now__cover/);
    expect(app).toMatch(/onSwipeUp:\s*\(\) => next\(1\)/);
    expect(app).toMatch(/onSwipeDown:\s*\(\) => next\(-1\)/);
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

  it("theme drawer opens on the current layout and keeps recents", () => {
    expect(switcher).toMatch(/loadSkinRecents/);
    expect(switcher).toMatch(/pushSkinRecent/);
    expect(switcher).toMatch(/skin-panel__recents/);
    expect(switcher).toMatch(/setLayoutFilter\(lay\)/);
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

  it("list and failed covers show a note glyph instead of a blank box", () => {
    const cover = fs.readFileSync(
      path.join(root, "client/src/components/CoverImg.tsx"),
      "utf8"
    );
    const list = fs.readFileSync(
      path.join(root, "client/src/components/TrackList.tsx"),
      "utf8"
    );
    const css = fs.readFileSync(
      path.join(root, "client/src/styles/global.css"),
      "utf8"
    );
    expect(cover).toMatch(/cov--empty/);
    expect(cover).toMatch(/♪/);
    expect(list).toMatch(/<CoverImg src=\{t\.cover\}/);
    expect(list).not.toMatch(/<div className="cov" \/>/);
    expect(css).toMatch(/\.cov--empty\s*\{/);
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

  it("gallery phone chrome leaves room for the cover grid", () => {
    const gallery = fs.readFileSync(
      path.join(root, "client/src/skins/layouts/gallery.css"),
      "utf8"
    );
    const phone = gallery.split("@media (max-width: 720px)")[1] || "";
    expect(phone).toMatch(/--gal-bar-h:\s*72px/);
    expect(phone).toMatch(/48px \+ 8px/);
    expect(phone).not.toMatch(/--gal-bar-h:\s*96px/);
  });

  it("gallery hides the page Charts heading at every width", () => {
    const gallery = fs.readFileSync(
      path.join(root, "client/src/skins/layouts/gallery.css"),
      "utf8"
    );
    expect(gallery).toMatch(
      /\.skin-host\[data-tab="charts"\] \.gal-main__head\s*\{[^}]*display:\s*none/s
    );
  });

  it("reduced-motion does not nuke every transition with a global star rule", () => {
    const css = fs.readFileSync(
      path.join(root, "client/src/styles/global.css"),
      "utf8"
    );
    expect(css).not.toMatch(
      /prefers-reduced-motion:\s*reduce\)\s*\{\s*\*\s*\{[^}]*animation:\s*none\s*!important/s
    );
  });

  it("inactive lyric lines are muted by color, not stacked opacity", () => {
    expect(layouts).toMatch(/\.lyrics-panel \.ly\s*\{[^}]*color-mix\(in srgb, var\(--fg\)/s);
    expect(layouts).not.toMatch(/\.lyrics-panel \.ly\s*\{[^}]*opacity:\s*0\.4/s);
  });

  it("classic shells keep a single quality picker", () => {
    expect(layouts).toMatch(
      /\.side-player > \.transport \.quality-wrap,\s*\n\s*\.imm-now > \.transport \.quality-wrap,\s*\n\s*\.layout-compact \.player-bar__controls > \.transport \.quality-wrap \{\s*\n\s*display:\s*none/
    );
    expect(layouts).toMatch(/\.quality-wrap--keep/);
  });

  it("transport controls meet touch-friendly sizes", () => {
    expect(layouts).toMatch(/\.t-btn\s*\{[^}]*min-width:\s*44px/s);
    expect(layouts).toMatch(/\.t-btn\.play\s*\{[^}]*56px/s);
  });
});
