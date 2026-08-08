/**
 * Disk cache for cover images (and optional warm-from-chart).
 * Path: data/covers/{sha1}.{ext}
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config.js";

const COVER_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FILES = 800;

function coversDir(): string {
  const d = path.join(dataDir(), "covers");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export function coverHash(url: string): string {
  return crypto.createHash("sha1").update(String(url)).digest("hex");
}

function extFromContentType(ct: string): string {
  const c = (ct || "").toLowerCase();
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  if (c.includes("gif")) return "gif";
  if (c.includes("svg")) return "svg";
  return "jpg";
}

function findCachedFile(hash: string): { file: string; mtime: number } | null {
  const dir = coversDir();
  try {
    const files = fs.readdirSync(dir).filter((f) => f.startsWith(hash + "."));
    if (!files.length) return null;
    const file = path.join(dir, files[0]);
    const st = fs.statSync(file);
    return { file, mtime: st.mtimeMs };
  } catch {
    return null;
  }
}

export type CoverHit = {
  body: Buffer;
  contentType: string;
  fromCache: boolean;
};

/** Read fresh disk hit or null. */
export function readCoverCache(url: string): CoverHit | null {
  if (!url || !url.startsWith("http")) return null;
  const hit = findCachedFile(coverHash(url));
  if (!hit) return null;
  if (Date.now() - hit.mtime > COVER_TTL_MS) return null;
  try {
    const body = fs.readFileSync(hit.file);
    if (body.length < 32) return null;
    const ext = path.extname(hit.file).slice(1).toLowerCase();
    const contentType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : "image/jpeg";
    return { body, contentType, fromCache: true };
  } catch {
    return null;
  }
}

export function writeCoverCache(url: string, body: Buffer, contentType: string): void {
  if (!url || body.length < 32) return;
  try {
    const hash = coverHash(url);
    const ext = extFromContentType(contentType);
    const dir = coversDir();
    // remove other extensions for same hash
    for (const f of fs.readdirSync(dir)) {
      if (f.startsWith(hash + ".")) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
          /* */
        }
      }
    }
    fs.writeFileSync(path.join(dir, `${hash}.${ext}`), body);
    pruneCovers();
  } catch {
    /* disk full etc */
  }
}

function pruneCovers() {
  try {
    const dir = coversDir();
    const entries = fs
      .readdirSync(dir)
      .map((f) => {
        const p = path.join(dir, f);
        try {
          return { p, mtime: fs.statSync(p).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as { p: string; mtime: number }[];
    if (entries.length <= MAX_FILES) return;
    entries.sort((a, b) => a.mtime - b.mtime);
    for (const e of entries.slice(0, entries.length - MAX_FILES)) {
      try {
        fs.unlinkSync(e.p);
      } catch {
        /* */
      }
    }
  } catch {
    /* */
  }
}

/** Fetch remote cover, cache to disk, return bytes. */
export async function fetchAndCacheCover(url: string): Promise<CoverHit | null> {
  const cached = readCoverCache(url);
  if (cached) return cached;
  try {
    const up = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://music.163.com/",
        Accept: "image/*,*/*",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!up.ok) return null;
    const ab = await up.arrayBuffer();
    const body = Buffer.from(ab);
    const contentType = up.headers.get("Content-Type") || "image/jpeg";
    writeCoverCache(url, body, contentType);
    return { body, contentType, fromCache: false };
  } catch {
    return null;
  }
}

/** Warm many cover URLs with limited concurrency (non-blocking caller). */
export async function warmCoverUrls(urls: string[], concurrency = 4): Promise<void> {
  const list = [...new Set(urls.filter((u) => u && u.startsWith("http")))].slice(0, 48);
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const u = list[i++];
      if (readCoverCache(u)) continue;
      await fetchAndCacheCover(u);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, () => worker()));
}
