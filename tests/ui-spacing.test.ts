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

  it("demo banner is dismissible and does not force 100dvh children off-screen", () => {
    const css = fs.readFileSync(
      path.join(root, "client/src/styles/global.css"),
      "utf8"
    );
    expect(app).toMatch(/demo-readonly-banner__close/);
    expect(app).toMatch(/data-demo-banner/);
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

  it("transport controls meet touch-friendly sizes", () => {
    expect(layouts).toMatch(/\.t-btn\s*\{[^}]*min-width:\s*44px/s);
    expect(layouts).toMatch(/\.t-btn\.play\s*\{[^}]*56px/s);
  });
});
