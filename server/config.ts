import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Project root: works from `server/` (tsx) and `dist/server/` (compiled). */
export const ROOT = (() => {
  const parent = path.resolve(__dirname, "..");
  // dist/server → dist → project root
  if (path.basename(__dirname) === "server" && path.basename(parent) === "dist") {
    return path.resolve(parent, "..");
  }
  // server → project root
  return parent;
})();

function loadDotenv() {
  for (const candidate of [path.join(ROOT, ".env"), path.join(process.cwd(), ".env")]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const text = fs.readFileSync(candidate, "utf8");
      for (const line of text.split("\n")) {
        const s = line.trim();
        if (!s || s.startsWith("#") || !s.includes("=")) continue;
        const i = s.indexOf("=");
        const key = s.slice(0, i).trim();
        let val = s.slice(i + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) process.env[key] = val;
      }
    } catch {
      /* ignore */
    }
    break;
  }
}

loadDotenv();

/** Default: free public gateway (api.chksz.top). Override via CHKSZ_API_BASE. */
export const CHKSZ_API_BASE = (process.env.CHKSZ_API_BASE || "https://api.chksz.top").replace(
  /\/$/,
  ""
);

export const CHKSZ_APIKEY = (
  process.env.CHKSZ_APIKEY ||
  process.env.CHKSZ_TOKEN ||
  process.env.API_TOKEN ||
  ""
).trim();

const DEFAULT_QUALITY = [
  "jymaster",
  "sky",
  "jyeffect",
  "hires",
  "lossless",
  "exhigh",
  "higher",
  "standard",
] as const;

export function qualityLevels(preferred?: string | null): string[] {
  const env = (process.env.CHKSZ_QUALITY_LEVELS || "").trim();
  let levels = env
    ? env.split(",").map((x) => x.trim()).filter(Boolean)
    : [...DEFAULT_QUALITY];
  if (preferred?.trim()) {
    const pref = preferred.trim().toLowerCase();
    levels = [pref, ...levels.filter((x) => x !== pref)];
  }
  return levels;
}

export function dataDir(): string {
  const raw = process.env.MUSIC_DATA_DIR || path.join(ROOT, "data");
  const p = path.isAbsolute(raw) ? raw : path.resolve(ROOT, raw);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function libraryDbPath(): string {
  return path.join(dataDir(), "library.db");
}

export const HOST = process.env.HOST || "127.0.0.1";
export const PORT = Number(process.env.PORT || "8787") || 8787;
