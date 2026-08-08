/**
 * Parse /favs export JSON only (strict).
 * Shape: { exportedAt?, source?, count?, favorites: Track[] }
 * Dedupes by id within the file.
 */

export type FavsExportTrack = {
  id: string | number;
  name: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
};

export type ParseFavsResult =
  | { ok: true; tracks: FavsExportTrack[] }
  | { ok: false; error: string };

/** True if object looks like our /favs export (not arbitrary playlist dumps). */
export function isFavsExportShape(raw: unknown): raw is {
  favorites: unknown[];
  exportedAt?: string;
  source?: string;
  count?: number;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.favorites);
}

export function parseFavsExportJson(raw: unknown): ParseFavsResult {
  if (!isFavsExportShape(raw)) {
    return {
      ok: false,
      error: "格式不对：请使用 /favs 导出的 JSON（需含 favorites 数组）",
    };
  }
  const out: FavsExportTrack[] = [];
  const seen = new Set<string>();
  for (const t of raw.favorites) {
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

/** How many of `incoming` are not already in `existing` (by id). */
export function countNewFavorites(
  existing: { id?: string | number }[],
  incoming: { id?: string | number }[]
): number {
  const have = new Set(
    (existing || []).map((t) => String(t?.id ?? "")).filter(Boolean)
  );
  let n = 0;
  const seen = new Set<string>();
  for (const t of incoming || []) {
    const k = String(t?.id ?? "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (!have.has(k)) n++;
  }
  return n;
}
