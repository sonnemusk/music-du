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

/** Parse favorites export / library JSON into Track[]. */
export function parseFavoritesImport(raw: unknown): Track[] {
  let list: any[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    const o = raw as any;
    list = o.favorites || o.tracks || o.data?.favorites || [];
  }
  const out: Track[] = [];
  const seen = new Set<string>();
  for (const t of list) {
    if (!t || t.id == null || t.id === "") continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: /^\d+$/.test(k) ? Number(k) : t.id,
      name: String(t.name || t.title || ""),
      artist: String(t.artist || t.artists || t.singer || ""),
      album: String(t.album || ""),
      cover: String(t.cover || t.picUrl || ""),
      duration: Number(t.duration || t.dt || 0) || 0,
    });
  }
  return out;
}
