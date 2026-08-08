/**
 * Shared env for Node + Cloudflare Workers.
 * Never call fileURLToPath unless import.meta.url is a real string (Workers can lack it).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function moduleDir(): string {
  try {
    const u = import.meta?.url;
    if (typeof u === "string" && u.length > 0) {
      return path.dirname(fileURLToPath(u));
    }
  } catch {
    /* Workers / non-file URL */
  }
  try {
    return process.cwd();
  } catch {
    return ".";
  }
}

/** Project root: works from `server/` (tsx) and `dist/server/` (compiled). */
export const ROOT = (() => {
  const dir = moduleDir();
  const parent = path.resolve(dir, "..");
  if (path.basename(dir) === "server" && path.basename(parent) === "dist") {
    return path.resolve(parent, "..");
  }
  if (path.basename(dir) === "server") return parent;
  return parent;
})();

function loadDotenv() {
  try {
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
        /* */
      }
      break;
    }
  } catch {
    /* Workers without real fs */
  }
}

loadDotenv();

/** Default free gateway. Override via CHKSZ_API_BASE. */
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

/** High → low. Used to pick “top 3 that actually have a URL” per track. */
export const DEFAULT_QUALITY = [
  "jymaster",
  "sky",
  "jyeffect",
  "hires",
  "lossless",
  "exhigh",
  "higher",
  "standard",
] as const;

export type QualityLevelId = (typeof DEFAULT_QUALITY)[number];

export function qualityLadder(): string[] {
  const env = (process.env.CHKSZ_QUALITY_LEVELS || "").trim();
  if (env) return env.split(",").map((x) => x.trim()).filter(Boolean);
  return [...DEFAULT_QUALITY];
}

export function qualityLevels(preferred?: string | null): string[] {
  let levels = qualityLadder();
  if (preferred?.trim()) {
    const pref = preferred.trim().toLowerCase();
    levels = [pref, ...levels.filter((x) => x !== pref)];
  }
  return levels;
}

export function dataDir(): string {
  const raw = process.env.MUSIC_DATA_DIR || path.join(ROOT, "data");
  const p = path.isAbsolute(raw) ? raw : path.resolve(ROOT, raw);
  try {
    fs.mkdirSync(p, { recursive: true });
  } catch {
    /* */
  }
  return p;
}

export function libraryDbPath(): string {
  return path.join(dataDir(), "library.db");
}

export const HOST = process.env.HOST || "127.0.0.1";
export const PORT = Number(process.env.PORT || "8787") || 8787;
