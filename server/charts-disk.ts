/**
 * Node/VPS-only durable chart cache under data/charts/.
 * Never import this from the Cloudflare Worker entry.
 */
import fs from "node:fs";
import path from "node:path";
import type { ChartCacheEntry, ChartDiskCache } from "./charts.js";
import { dataDir } from "./config.js";
import { warmCoverUrls } from "./cover-cache.js";

function chartsDir(): string {
  const d = path.join(dataDir(), "charts");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function diskPath(cacheKey: string): string {
  const safe = cacheKey.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return path.join(chartsDir(), `${safe}.json`);
}

export function createChartDiskCache(): ChartDiskCache {
  return {
    read(cacheKey: string): ChartCacheEntry | null {
      try {
        const p = diskPath(cacheKey);
        if (!fs.existsSync(p)) return null;
        const raw = JSON.parse(fs.readFileSync(p, "utf8")) as ChartCacheEntry;
        if (!raw?.payload?.tracks?.length || typeof raw.at !== "number") return null;
        return raw;
      } catch {
        return null;
      }
    },
    write(cacheKey: string, entry: ChartCacheEntry) {
      try {
        fs.writeFileSync(diskPath(cacheKey), JSON.stringify(entry));
      } catch {
        /* */
      }
    },
    clear() {
      try {
        const dir = chartsDir();
        for (const f of fs.readdirSync(dir)) {
          if (f.endsWith(".json")) fs.unlinkSync(path.join(dir, f));
        }
      } catch {
        /* */
      }
    },
  };
}

/** Disk cover warm used by chart pipeline on VPS only. */
export function createChartCoverWarmer() {
  return (urls: string[]) => {
    void warmCoverUrls(urls, 3).catch(() => {});
  };
}
