import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CJK_SANS, finishFontStack, fontCssVars } from "../client/src/lib/fonts.js";
import { deskThemeVars, THEMES as DESK_THEMES } from "../client/src/skins/experiences/desk/theme.js";
import { feedThemeToCssVars, THEMES as FEED_THEMES } from "../client/src/skins/experiences/feed/theme.js";
import { findThemeToCssVars, FIND_THEMES } from "../client/src/skins/experiences/find/theme.js";
import { likesThemeToCssVars, LIKES_THEMES } from "../client/src/skins/experiences/likes/theme.js";
import { recentThemeToCssVars, RECENT_THEMES } from "../client/src/skins/experiences/recent/theme.js";
import { splitThemeToCssVars, SPLIT_THEMES } from "../client/src/skins/experiences/split/theme.js";
import { stageThemeToCssVars, STAGE_THEMES } from "../client/src/skins/experiences/stage/theme.js";
import { verseThemeToCssVars, VERSE_THEMES } from "../client/src/skins/experiences/verse/theme.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === "node_modules" || ent.name === "dist" || ent.name.startsWith(".")) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js|jsx|html|css)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

describe("China-safe fonts", () => {
  it("finishes stacks with system CJK sans and drops Songti / SimSun", () => {
    expect(CJK_SANS).toMatch(/PingFang SC/);
    expect(CJK_SANS).toMatch(/Hiragino Sans GB/);
    expect(CJK_SANS).toMatch(/Noto Sans SC/);
    expect(CJK_SANS).toMatch(/Microsoft YaHei/);
    expect(CJK_SANS).toMatch(/HarmonyOS Sans SC/);

    const cleaned = finishFontStack('"Playfair Display", "Songti SC", Georgia, serif', "display");
    expect(cleaned).toMatch(/^"Playfair Display"/);
    expect(cleaned).toMatch(/PingFang SC/);
    expect(cleaned).toMatch(/Microsoft YaHei/);
    expect(cleaned).not.toMatch(/Songti|SimSun|FangSong|KaiTi/);
    expect(cleaned.match(/PingFang SC/g)?.length).toBe(1);

    const ugly = finishFontStack('"DM Sans", SimSun, "KaiTi", sans-serif');
    expect(ugly).not.toMatch(/SimSun|KaiTi/);
    expect(ugly).toMatch(/PingFang SC/);

    const mono = finishFontStack('"IBM Plex Mono", ui-monospace, monospace', "mono");
    expect(mono).toMatch(/IBM Plex Mono/);
    expect(mono).toMatch(/Sarasa Mono SC|ui-monospace/);
    expect(mono).not.toMatch(/PingFang SC/);
  });

  it("fontCssVars always emit CJK-backed --font / --display-font", () => {
    const vars = fontCssVars({
      font: '"Instrument Serif", Georgia, serif',
      displayFont: '"Playfair Display", "Songti SC", Georgia, serif',
    });
    expect(vars["--font"]).toMatch(/PingFang SC/);
    expect(vars["--display-font"]).toMatch(/PingFang SC/);
    expect(vars["--display-font"]).not.toMatch(/Songti/);
    expect(vars["--mono-font"]).toMatch(/monospace/);
  });

  it("experience theme helpers apply the same CJK finish", () => {
    const samples = [
      ...DESK_THEMES.map(deskThemeVars),
      ...FEED_THEMES.map(feedThemeToCssVars),
      ...FIND_THEMES.map(findThemeToCssVars),
      ...LIKES_THEMES.map(likesThemeToCssVars),
      ...RECENT_THEMES.map(recentThemeToCssVars),
      ...SPLIT_THEMES.map(splitThemeToCssVars),
      ...STAGE_THEMES.map(stageThemeToCssVars),
      ...VERSE_THEMES.map(verseThemeToCssVars),
    ];
    expect(samples.length).toBeGreaterThanOrEqual(16);
    for (const vars of samples) {
      expect(vars["--font"]).toMatch(/PingFang SC/);
      expect(vars["--font"]).toMatch(/Microsoft YaHei/);
      expect(vars["--font"]).not.toMatch(/Songti|SimSun|FangSong|KaiTi/);
      expect(vars["--display-font"]).not.toMatch(/Songti|SimSun|FangSong|KaiTi/);
    }
  });

  it("client source does not load Google Fonts", () => {
    const files = walk(path.join(root, "client"));
    expect(files.length).toBeGreaterThan(20);
    const hits: string[] = [];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      if (/https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(src)) hits.push(path.relative(root, file));
    }
    expect(hits).toEqual([]);
  });

  it("boot path loads DM Sans only; Outfit waits for a theme that uses it", () => {
    const main = fs.readFileSync(path.join(root, "client/src/main.tsx"), "utf8");
    const fonts = fs.readFileSync(path.join(root, "client/src/lib/fonts.ts"), "utf8");
    expect(main).toMatch(/@fontsource\/dm-sans/);
    expect(main).not.toMatch(/@fontsource\/outfit/);
    expect(fonts).toMatch(/const loaded = new Set<string>\(\["DM Sans"\]\)/);
    expect(fonts).toMatch(/export function ensureThemeFont[\s\S]*Promise<void>/);
  });

  it("index.html has no Google Fonts preconnect / stylesheet", () => {
    const html = fs.readFileSync(path.join(root, "client/index.html"), "utf8");
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });

  it("body stack lists the same CJK sans faces", () => {
    const css = fs.readFileSync(path.join(root, "client/src/styles/global.css"), "utf8");
    expect(css).toMatch(/PingFang SC/);
    expect(css).toMatch(/Hiragino Sans GB/);
    expect(css).toMatch(/Noto Sans SC/);
    expect(css).toMatch(/Microsoft YaHei/);
    expect(css).not.toMatch(/Songti|SimSun/);
  });
});
