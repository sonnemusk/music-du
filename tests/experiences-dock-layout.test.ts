import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { THEMES } from "../client/src/skins/experiences/dock/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dockDir = path.join(root, "client/src/skins/experiences/dock");

function read(name: string): string {
  return fs.readFileSync(path.join(dockDir, name), "utf8");
}

describe("dock layout polish", () => {
  it("DockLayout has no SkinHead / TabNav / stock layouts", () => {
    const tsx = read("DockLayout.tsx");
    expect(tsx).not.toMatch(/SkinHead/);
    expect(tsx).not.toMatch(/TabNav/);
    expect(tsx).not.toMatch(/SideLayout|ImmersiveLayout|CompactLayout|GalleryLayout/);
  });

  it("dim vs deep stay distinct (bg, accent, wallpaper)", () => {
    const dim = THEMES.find((t) => t.id === "dock-dim");
    const deep = THEMES.find((t) => t.id === "dock-deep");
    expect(dim).toBeTruthy();
    expect(deep).toBeTruthy();
    expect(dim!.bg.toLowerCase()).not.toBe(deep!.bg.toLowerCase());
    expect(dim!.accent.toLowerCase()).not.toBe(deep!.accent.toLowerCase());
    expect(dim!.themeColor.toLowerCase()).not.toBe(deep!.themeColor.toLowerCase());
    expect(dim!.wallpaper).not.toBe(deep!.wallpaper);
    expect(dim!.bg).toBe("#2a2b28");
    expect(deep!.bg).toBe("#061a16");
  });

  it("720px block sizes play/prev/next at 44px (not 36)", () => {
    const css = read("dock.css");
    expect(css).toMatch(/@media\s*\(\s*max-width:\s*720px\s*\)/);
    const start = css.indexOf("max-width: 720px");
    expect(start).toBeGreaterThan(-1);
    const phone = css.slice(start, start + 2200);
    expect(phone).toMatch(/dock-mini__play/);
    expect(phone).toMatch(/dock-mini__skip/);
    expect(phone).toMatch(/min-width:\s*44px/);
    expect(phone).toMatch(/min-height:\s*44px/);
    expect(phone).not.toMatch(/dock-mini__(play|skip)[^{]*\{[^}]*36px/);
  });

  it("phone bottom tabs use full tab keys, never tabs.*Short", () => {
    const tsx = read("DockLayout.tsx");
    expect(tsx).not.toMatch(/tabs\.\$\{id\}Short/);
    expect(tsx).not.toMatch(/`tabs\.\$\{id\}Short`/);
    const fromTabs = tsx.slice(tsx.indexOf('className="dock-tabs"'));
    const phoneBlock = fromTabs.slice(0, fromTabs.indexOf("</nav>"));
    expect(phoneBlock).toMatch(/NAV_TABS\.map/);
    expect(phoneBlock).toMatch(/tabLabel\(tr, id\)/);
    expect(phoneBlock).not.toMatch(/Short/);
  });

  it("same-row chrome uses flex + align-items center", () => {
    const css = read("dock.css");
    for (const sel of [".dock-head", ".dock-mini", ".dock-mini__acts", ".dock-tools", ".dock-tabs"]) {
      const re = new RegExp(`${sel.replace(".", "\\.")}[^{]*\\{[^}]*align-items:\\s*center`, "s");
      expect(css, sel).toMatch(re);
    }
    expect(css).toMatch(/\.layout-dock\s+\.dock-mini\.player-bar[^{]*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.dock-mini[^{]*\{[^}]*flex-wrap:\s*nowrap/s);
  });

  it("interactive dock chrome has no negative margins", () => {
    const css = read("dock.css");
    const hits = [
      ...css.matchAll(
        /\.(dock-(?:mini__(?:play|skip|now|acts)|tab|search-launch|sheet__close|tools|head))\s*\{([^}]*)\}/g
      ),
    ];
    expect(hits.length).toBeGreaterThan(4);
    for (const m of hits) {
      expect(m[2], m[1]).not.toMatch(/margin(?:-(?:top|right|bottom|left))?:\s*-/);
    }
  });

  it("sheet stacks below search overlay 900 and theme panel 2000", () => {
    const css = read("dock.css");
    expect(css).toMatch(/--dock-sheet-z:\s*80/);
    expect(css).toMatch(/\.layout-dock\s*>\s*\.dock-sheet/);
    const tsx = read("DockLayout.tsx");
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/SkinSwitcher/);
  });

  it("phone now-playing is in-flow; dialog sheet stays desktop", () => {
    const tsx = read("DockLayout.tsx");
    const css = read("dock.css");
    expect(tsx).toMatch(/className="dock-now"/);
    expect(tsx).toMatch(/phone && sheet/);
    expect(tsx).toMatch(/sheet && !phone/);
    expect(tsx).toMatch(/shell\.faceCover|faceCover/);
    expect(css).toMatch(/\.dock-now/);
    expect(css).toMatch(/\[data-face="lyrics"\] \.dock-now__cover-slot/);
  });

  it("overflow-x is hidden on shell, head, mini, tabs, main", () => {
    const css = read("dock.css");
    expect(css).toMatch(/\.layout-dock\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).toMatch(/\.dock-head\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).toMatch(/\.dock-mini[^{]*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).toMatch(/\.dock-tabs\s*\{[^}]*overflow-x:\s*hidden/s);
    expect(css).toMatch(/\.dock-main\s*\{[^}]*overflow-x:\s*hidden/s);
  });

  it("uses 100% host height and safe-area insets", () => {
    const css = read("dock.css");
    expect(css).toMatch(/height:\s*100%/);
    expect(css).toMatch(/env\(safe-area-inset-top/);
    expect(css).toMatch(/env\(safe-area-inset-bottom/);
    expect(css).toMatch(/font-size:\s*16px/);
  });

  it("every owned button has a visible label or aria-label", () => {
    const tsx = read("DockLayout.tsx");
    const buttons = [...tsx.matchAll(/<button\b[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(buttons.length).toBeGreaterThan(6);
    for (const btn of buttons) {
      const hasAria = /aria-label=\{/.test(btn);
      const inner = btn.replace(/<button\b[\s\S]*?>/, "").replace(/<\/button>/, "");
      const hasText = /\{tr\(|\{tabLabel\(|\{item\}|⏮|⏭|▶|⏸|⌕/.test(inner);
      expect(hasAria || hasText, btn.slice(0, 160)).toBe(true);
    }
  });

  it("desktop and phone can reach site features (no social)", () => {
    const tsx = read("DockLayout.tsx");
    expect(tsx).toMatch(/openMobileSearchFromGesture/);
    expect(tsx).toMatch(/<SearchBar/);
    expect(tsx).toMatch(/LocaleSwitcher/);
    expect(tsx).toMatch(/SkinSwitcher/);
    expect(tsx).toMatch(/ChartsPanel/);
    expect(tsx).toMatch(/LyricsView/);
    expect(tsx).toMatch(/mode="favorites"/);
    expect(tsx).toMatch(/mode="playlist"/);
    expect(tsx).toMatch(/mode="history"/);
    expect(tsx).toMatch(/<Transport\s*\/>/);
    expect(tsx).toMatch(/togglePlay/);
    expect(tsx).toMatch(/next\(-1\)/);
    expect(tsx).toMatch(/next\(1\)/);
    expect(tsx).not.toMatch(/comment|social|follow|mv\b|vip/i);
  });
});
