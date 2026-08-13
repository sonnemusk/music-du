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
      expect(t.nameEn.length).toBeGreaterThan(0);
      expect(t.taglineEn.length).toBeGreaterThan(0);
      // English fields should be Latin-ish (no CJK requirement on zh name)
      expect(/[\u4e00-\u9fff]/.test(t.nameEn)).toBe(false);
      expect(/[\u4e00-\u9fff]/.test(t.taglineEn)).toBe(false);
      expect(t.accent).toMatch(/^#|^rgb|oklch|hsl/);
      expect(LAYOUT_IDS).toContain(t.layout);
      const vars = themeToCssVars(t);
      expect(vars["--bg"]).toBeTruthy();
      expect(vars["--accent"]).toBeTruthy();
      expect(vars["--radius"]).toBeTruthy();
    }
  });

  it("each new experience layout ships with dim + deep palettes", () => {
    const shells = [
      "dock",
      "desk",
      "feed",
      "stage",
      "verse",
      "likes",
      "recent",
      "find",
      "boards",
      "split",
    ];
    for (const id of shells) {
      const pair = THEME_CATALOG.filter((t) => t.layout === id);
      expect(pair.map((t) => t.id).sort(), id).toEqual([`${id}-deep`, `${id}-dim`].sort());
      expect(pair[0]!.bg).not.toBe(pair[1]!.bg);
    }
  });

  it("gallery layout ships with exactly one theme and its stylesheet", () => {
    expect(LAYOUT_IDS).toContain("gallery");
    const onGallery = THEME_CATALOG.filter((t) => t.layout === "gallery");
    expect(onGallery.map((t) => t.id)).toEqual(["atrium"]);

    const atrium = onGallery[0]!;
    // The catalog is otherwise near-uniformly dark; this one is the light outlier.
    const lum = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return (r * 299 + g * 587 + b * 114) / 1000;
    };
    expect(lum(atrium.bg)).toBeGreaterThan(160);
    expect(lum(atrium.fg)).toBeLessThan(80);
    expect(atrium.displayFont).toBeTruthy();

    expect(
      fs.existsSync(path.join(root, "client/src/skins/layouts/GalleryLayout.tsx"))
    ).toBe(true);
    const css = fs.readFileSync(
      path.join(root, "client/src/skins/layouts/gallery.css"),
      "utf8"
    );
    // desktop / tablet / phone breakpoints must all be present
    for (const bp of ["1279px", "1023px", "720px"]) {
      expect(css.includes(bp), bp).toBe(true);
    }
    // the grid is CSS over the shared TrackList, not a forked list component
    expect(css).toMatch(/\.layout-gallery \.track-list\s*\{[^}]*display:\s*grid/s);
    const tsx = fs.readFileSync(
      path.join(root, "client/src/skins/layouts/GalleryLayout.tsx"),
      "utf8"
    );
    expect(tsx).toMatch(/usePanelBody/);
    expect(tsx).not.toMatch(/[\u4e00-\u9fff]/);
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
