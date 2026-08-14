/** Block RFC1918 / link-local / localhost before Node proxies an upstream URL. */
export function isPrivateHostname(host: string): boolean {
  const h = String(host || "")
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (
    h === "localhost" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h === "metadata.google.internal" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local")
  ) {
    return true;
  }
  const ip4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ip4) {
    const a = Number(ip4[1]);
    const b = Number(ip4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  return false;
}

export function isSafeUpstreamUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (isPrivateHostname(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
