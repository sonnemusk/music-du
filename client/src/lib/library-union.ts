import type { Track } from "./types";

/** Prefer primary order; append secondary-only ids. */
export function unionTracksById(primary: Track[], secondary: Track[]): Track[] {
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const t of primary || []) {
    if (t?.id == null || t.id === "") continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  for (const t of secondary || []) {
    if (t?.id == null || t.id === "") continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/**
 * Parse /favs export JSON only.
 * Required shape: { favorites: [ { id, name, artist, album?, cover?, duration? } ] }
 */
export function parseFavoritesImport(raw: unknown): {
  ok: true;
  tracks: Track[];
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      error: "格式不对：请使用 /favs 导出的 JSON（需含 favorites 数组）",
    };
  }
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.favorites)) {
    return {
      ok: false,
      error: "格式不对：请使用 /favs 导出的 JSON（需含 favorites 数组）",
    };
  }
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const t of o.favorites) {
    if (!t || typeof t !== "object") continue;
    const row = t as Record<string, unknown>;
    if (row.id == null || row.id === "") continue;
    const k = String(row.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: /^\d+$/.test(k) ? Number(k) : (row.id as string | number),
      name: String(row.name ?? ""),
      artist: String(row.artist ?? ""),
      album: String(row.album ?? ""),
      cover: String(row.cover ?? ""),
      duration: Number(row.duration ?? 0) || 0,
    });
  }
  if (!out.length) {
    return { ok: false, error: "favorites 为空或没有有效 id" };
  }
  return { ok: true, tracks: out };
}
