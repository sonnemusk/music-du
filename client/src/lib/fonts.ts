/** System CJK faces that stay readable when Google Fonts is blocked in China. */
export const CJK_SANS =
  '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Noto Sans CJK SC", "HarmonyOS Sans SC", "Microsoft YaHei UI", "Microsoft YaHei"';

const UGLY_CJK =
  /"?Songti SC"?|"?STSong"?|"?SimSun(?:-ExtB)?"?|"?NSimSun"?|"?FangSong"?|"?KaiTi"?|"?STKaiti"?/gi;

const LATIN_LOADERS: Record<string, () => Promise<unknown>> = {
  "Bebas Neue": () => import("@fontsource/bebas-neue/latin-400.css"),
  "DM Sans": () =>
    Promise.all([
      import("@fontsource/dm-sans/latin-400.css"),
      import("@fontsource/dm-sans/latin-600.css"),
      import("@fontsource/dm-sans/latin-800.css"),
    ]),
  "IBM Plex Mono": () =>
    Promise.all([
      import("@fontsource/ibm-plex-mono/latin-400.css"),
      import("@fontsource/ibm-plex-mono/latin-600.css"),
    ]),
  "Instrument Serif": () =>
    Promise.all([
      import("@fontsource/instrument-serif/latin-400.css"),
      import("@fontsource/instrument-serif/latin-400-italic.css"),
    ]),
  "JetBrains Mono": () =>
    Promise.all([
      import("@fontsource/jetbrains-mono/latin-400.css"),
      import("@fontsource/jetbrains-mono/latin-600.css"),
    ]),
  Outfit: () =>
    Promise.all([
      import("@fontsource/outfit/latin-400.css"),
      import("@fontsource/outfit/latin-600.css"),
      import("@fontsource/outfit/latin-800.css"),
    ]),
  "Playfair Display": () =>
    Promise.all([
      import("@fontsource/playfair-display/latin-600.css"),
      import("@fontsource/playfair-display/latin-700.css"),
    ]),
  "Space Grotesk": () =>
    Promise.all([
      import("@fontsource/space-grotesk/latin-500.css"),
      import("@fontsource/space-grotesk/latin-700.css"),
    ]),
  Syne: () =>
    Promise.all([
      import("@fontsource/syne/latin-600.css"),
      import("@fontsource/syne/latin-700.css"),
      import("@fontsource/syne/latin-800.css"),
    ]),
}

const loaded = new Set<string>(["DM Sans", "Outfit"]);

function firstFamily(stack: string | undefined): string {
  return stack?.split(",")[0]?.replace(/["']/g, "").trim() || "";
}

function stripUglyCjk(stack: string): string {
  return stack
    .replace(UGLY_CJK, "")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,|,\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop generic tails so we can append a complete CJK + fallback stack once. */
function stripTail(stack: string): string {
  return stack
    .replace(
      /(?:,\s*(?:system-ui|sans-serif|serif|monospace|ui-sans-serif|ui-monospace|ui-serif))+\s*$/i,
      ""
    )
    .trim()
    .replace(/,\s*$/, "");
}

function familyKey(face: string): string {
  return face.replace(/["']/g, "").trim().toLowerCase();
}

function mergeFaces(head: string, extras: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of `${head}, ${extras}`.split(",")) {
    const face = part.trim();
    if (!face) continue;
    const key = familyKey(face);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(face);
  }
  return out.join(", ");
}

export function finishFontStack(stack: string | undefined, kind: "sans" | "display" | "mono" = "sans"): string {
  const raw = stripUglyCjk(stack || "").trim();
  const head = stripTail(raw || '"DM Sans"');
  if (kind === "mono") {
    return mergeFaces(head, 'ui-monospace, "SF Mono", "Cascadia Mono", "Sarasa Mono SC", Menlo, Consolas, monospace');
  }
  return mergeFaces(head, `${CJK_SANS}, system-ui, sans-serif`);
}

export function fontCssVars(t: { font: string; displayFont?: string; monoFont?: string }) {
  return {
    "--font": finishFontStack(t.font, "sans"),
    "--display-font": finishFontStack(t.displayFont || t.font, "display"),
    "--mono-font": finishFontStack(t.monoFont || t.font, "mono"),
  };
}

/** Load a Latin webfont from the bundled package — no fonts.googleapis.com. */
export function ensureThemeFont(fontFamily: string | undefined) {
  if (!fontFamily || typeof document === "undefined") return;
  const name = firstFamily(fontFamily);
  if (!name || name === "system-ui" || /PingFang|Hiragino|YaHei|Noto Sans|HarmonyOS/.test(name)) {
    return;
  }
  const load = LATIN_LOADERS[name];
  if (!load || loaded.has(name)) return;
  loaded.add(name);
  void load().catch(() => {
    loaded.delete(name);
  });
}

export function ensureThemeFonts(...stacks: Array<string | undefined>) {
  for (const stack of stacks) ensureThemeFont(stack);
}
