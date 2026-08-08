/**
 * Shared cover upstream fetch (Worker + Node).
 * - Allowlist hosts (no open proxy)
 * - NetEase p1–p4 mirror fallback when one edge fails
 * - Never treat tiny / non-image bodies as success
 */

const COVER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Hosts we are willing to proxy (suffix match). */
const ALLOWED_HOST_SUFFIXES = [
  "music.126.net",
  "music.163.com",
  "gtimg.cn",
  "y.qq.com",
  // not bare qq.com (too broad / open-proxy risk)
  "kugou.com",
  "kuwo.cn",
  "douyinpic.com",
  "byteimg.com",
  "douyin.com",
  "xhscdn.com",
  "qpic.cn",
];

export function isAllowedCoverUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some(
      (s) => host === s || host.endsWith("." + s)
    );
  } catch {
    return false;
  }
}

/** NetEase CDN often rotates p1–p4; try siblings when one returns 404/timeout. */
export function coverMirrorCandidates(url: string): string[] {
  const out: string[] = [url];
  try {
    const u = new URL(url);
    const m = u.hostname.match(/^p([1-4])\.(music\.126\.net)$/i);
    if (!m) return out;
    for (const n of [1, 2, 3, 4]) {
      if (String(n) === m[1]) continue;
      const alt = new URL(url);
      alt.hostname = `p${n}.${m[2]}`;
      out.push(alt.toString());
    }
  } catch {
    /* */
  }
  return out;
}

function looksLikeImage(buf: ArrayBuffer, contentType: string): boolean {
  if (buf.byteLength < 32) return false;
  const ct = (contentType || "").toLowerCase();
  if (ct.startsWith("image/")) return true;
  if (ct.includes("octet-stream") || ct.includes("jpg") || ct.includes("jpeg")) {
    // accept with magic check
  } else if (ct && !ct.includes("octet") && !ct.includes("binary")) {
    // HTML/json error pages
    if (ct.includes("text/") || ct.includes("json") || ct.includes("html")) return false;
  }
  const b = new Uint8Array(buf);
  // JPEG
  if (b[0] === 0xff && b[1] === 0xd8) return true;
  // PNG
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true;
  // GIF
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;
  // WEBP (RIFF....WEBP)
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45
  )
    return true;
  return ct.startsWith("image/");
}

export type CoverUpstreamHit = {
  body: ArrayBuffer;
  contentType: string;
  finalUrl: string;
};

/**
 * Fetch cover bytes with mirror fallbacks.
 * Returns null if all candidates fail.
 */
export async function fetchCoverUpstream(
  url: string,
  opts?: { timeoutMs?: number }
): Promise<CoverUpstreamHit | null> {
  if (!url || !url.startsWith("http") || !isAllowedCoverUrl(url)) return null;
  const timeoutMs = opts?.timeoutMs ?? 10000;
  const candidates = coverMirrorCandidates(url);

  for (const candidate of candidates) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const up = await fetch(candidate, {
        headers: {
          "User-Agent": COVER_UA,
          Referer: "https://music.163.com/",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
        signal: ctrl.signal,
        redirect: "follow",
      });
      clearTimeout(timer);
      if (!up.ok) continue;
      const body = await up.arrayBuffer();
      const contentType = up.headers.get("Content-Type") || "image/jpeg";
      if (!looksLikeImage(body, contentType)) continue;
      return {
        body,
        contentType: contentType.startsWith("image/")
          ? contentType
          : "image/jpeg",
        finalUrl: candidate,
      };
    } catch {
      /* try next mirror */
    }
  }
  return null;
}

/** Standard error response: never cache failures in browser/CDN. */
export function coverErrorResponse(status: 400 | 403 | 404 | 502): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
      "X-Cover-Cache": "ERR",
    },
  });
}
