#!/usr/bin/env node
/**
 * Post-build budget for the SPA entry.
 * - index.html must not modulepreload SearchOverlay (lazy, first-open only)
 * - the main index-*.js gzip size stays under INDEX_GZIP_MAX
 */
import { gzipSync } from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist/client");
const htmlPath = path.join(dist, "index.html");

/** Headroom over the ~61 KB gzip entry after layout lazy-load. */
export const INDEX_GZIP_MAX = 70 * 1024;

export function assertBundleBudget(html, readAsset) {
  if (/modulepreload[^>]+SearchOverlay/i.test(html)) {
    throw new Error("index.html modulepreloads SearchOverlay — keep it lazy");
  }
  const preloads = [...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/gi)].map(
    (m) => m[1]
  );
  if (preloads.some((href) => /SearchOverlay/i.test(href))) {
    throw new Error("SearchOverlay chunk is modulepreloaded");
  }

  const script = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/i);
  if (!script) throw new Error("no module script in index.html");
  const src = script[1];
  const bytes = readAsset(src);
  const gz = gzipSync(bytes).length;
  if (gz > INDEX_GZIP_MAX) {
    throw new Error(
      `entry ${src} gzip ${gz} B exceeds ${INDEX_GZIP_MAX} B (${(INDEX_GZIP_MAX / 1024).toFixed(0)} KiB)`
    );
  }
  return { src, raw: bytes.length, gzip: gz };
}

function resolveAsset(href) {
  const clean = href.replace(/^\//, "");
  const file = path.join(dist, clean);
  if (!fs.existsSync(file)) throw new Error(`missing asset ${href}`);
  return fs.readFileSync(file);
}

function main() {
  if (!fs.existsSync(htmlPath)) {
    console.error("dist/client/index.html missing — run npm run build first");
    process.exit(2);
  }
  const html = fs.readFileSync(htmlPath, "utf8");
  const { src, raw, gzip } = assertBundleBudget(html, resolveAsset);
  console.log(
    `bundle ok  ${src}  raw=${(raw / 1024).toFixed(1)} KiB  gzip=${(gzip / 1024).toFixed(1)} KiB  cap=${(INDEX_GZIP_MAX / 1024).toFixed(0)} KiB`
  );
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
