/**
 * Free edge cache helpers (Cloudflare Workers Cache API).
 * No KV / R2 / paid products — only `caches.default` (included free).
 *
 * On Node/VPS `caches` is usually undefined → no-ops.
 *
 * NEVER use this for audio streams / media bodies.
 * Only JSON metadata (charts, song resolve, lyrics) and cover images.
 */

export type WaitUntilCtx = { waitUntil(promise: Promise<unknown>): void };

type CacheStorageLike = { default: { match(r: Request): Promise<Response | undefined>; put(r: Request, res: Response): Promise<void> } };

function getCaches(): CacheStorageLike | null {
  const c = (globalThis as { caches?: CacheStorageLike }).caches;
  return c?.default ? c : null;
}

/** Stable GET request key for Cache API */
export function cacheKeyFromUrl(url: string): Request {
  return new Request(url, { method: "GET" });
}

export async function edgeMatch(url: string): Promise<Response | null> {
  const c = getCaches();
  if (!c) return null;
  try {
    const hit = await c.default.match(cacheKeyFromUrl(url));
    return hit || null;
  } catch {
    return null;
  }
}

/**
 * Store response in edge cache. Clones response.
 * Prefer waitUntil so response returns without waiting for put.
 */
export function edgePut(
  url: string,
  response: Response,
  ctx?: WaitUntilCtx | null
): void {
  const c = getCaches();
  if (!c) return;
  if (!response.ok) return;
  try {
    const key = cacheKeyFromUrl(url);
    // Ensure cacheable: Cache API ignores some private responses
    const headers = new Headers(response.headers);
    const cc = headers.get("Cache-Control") || "";
    if (!/public|max-age|s-maxage/i.test(cc)) {
      headers.set("Cache-Control", "public, max-age=86400");
    }
    const toStore = new Response(response.clone().body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    const p = c.default.put(key, toStore).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(p);
    else void p;
  } catch {
    /* */
  }
}

export function withCacheHeaders(
  headers: Record<string, string>,
  kind: "cover" | "chart" | "lyric",
  opts?: { maxAgeSec?: number }
): Record<string, string> {
  if (kind === "cover") {
    return {
      ...headers,
      // 7d browser + edge; free CF CDN respects public + s-maxage
      "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000",
      "CDN-Cache-Control": "public, max-age=604800",
    };
  }
  if (kind === "chart") {
    const age = Math.max(300, opts?.maxAgeSec ?? 2 * 3600);
    const swr = Math.min(86400, age * 2);
    return {
      ...headers,
      "Cache-Control": `public, max-age=${age}, s-maxage=${age}, stale-while-revalidate=${swr}`,
      "CDN-Cache-Control": `public, max-age=${age}`,
    };
  }
  return {
    ...headers,
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
  };
}
