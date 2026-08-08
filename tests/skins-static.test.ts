import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SKIN, SKINS } from "../client/src/lib/types.js";
import { LAYOUT_IDS } from "../client/src/skins/layouts/layout-ids.js";
import { THEME_CATALOG, themeToCssVars } from "../client/src/skins/theme-catalog.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("theme catalog", () => {
  it("has 70+ themes with unique ids", () => {
    expect(THEME_CATALOG.length).toBeGreaterThanOrEqual(45);
    expect(SKINS.length).toBe(THEME_CATALOG.length);
    const ids = new Set(THEME_CATALOG.map((t) => t.id));
    expect(ids.size).toBe(THEME_CATALOG.length);
    expect(ids.has("studio")).toBe(false);
    expect(ids.has("layout-mosaic")).toBe(false);
    expect(ids.has("bento")).toBe(true); // former layout-mosaic palette
    expect(DEFAULT_SKIN).toBe("aurora");
  });

  it("exposes active layouts and every theme uses one", () => {
    expect(LAYOUT_IDS.length).toBeGreaterThanOrEqual(3);
    const used = new Set(THEME_CATALOG.map((t) => t.layout));
    for (const id of LAYOUT_IDS) {
      expect(used.has(id)).toBe(true);
    }
    // no orphan layout-* showcase skins
    for (const t of THEME_CATALOG) {
      expect(t.id.startsWith("layout-")).toBe(false);
    }
  });

  it("each theme has full tokens and css vars", () => {
    for (const t of THEME_CATALOG) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.accent).toMatch(/^#|^rgb|oklch|hsl/);
      expect(LAYOUT_IDS).toContain(t.layout);
      const vars = themeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
      expect(vars["--radius"]).toBeTruthy();
    }
  });

  it("refined base + host exist (responsive shared layouts)", () => {
    expect(fs.existsSync(path.join(root, "client/src/skins/SkinHost.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(root, "client/src/skins/themes/refined-base.css"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(root, "client/src/skins/layouts/SideLayout.tsx"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(root, "client/src/skins/layouts/ImmersiveLayout.tsx"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(root, "client/src/skins/layouts/CompactLayout.tsx"))).toBe(
      true
    );
    // dead layout samples removed
    expect(fs.existsSync(path.join(root, "client/src/skins/layouts/MoreLayouts.tsx"))).toBe(
      false
    );
    expect(fs.existsSync(path.join(root, "client/src/skins/layouts/SplitLayout.tsx"))).toBe(
      false
    );
  });
});
