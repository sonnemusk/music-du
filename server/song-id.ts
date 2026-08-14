/** Playable ids: NetEase digits, QQ `qq:mid`, Kugou `kg:hash`. `ext:` needs rematch. */

export type SongProvider = "netease" | "qq" | "kugou" | "ext";

export type ParsedSongId = {
  provider: SongProvider;
  nativeId: string;
};

export function parseSongId(id: string | number | null | undefined): ParsedSongId | null {
  const s = String(id ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { provider: "netease", nativeId: s };
  const m = s.match(/^(qq|kg|kugou|ext):(.+)$/i);
  if (!m) return null;
  const prefix = m[1]!.toLowerCase();
  const nativeId = m[2]!.trim();
  if (!nativeId) return null;
  if (prefix === "qq") return { provider: "qq", nativeId };
  if (prefix === "kg" || prefix === "kugou") return { provider: "kugou", nativeId };
  return { provider: "ext", nativeId };
}

export function isResolvedSongId(id: string | number | null | undefined): boolean {
  const p = parseSongId(id);
  return Boolean(p && p.provider !== "ext" && p.nativeId);
}

export function formatSongId(provider: Exclude<SongProvider, "ext">, nativeId: string): string {
  const id = String(nativeId || "").trim();
  if (provider === "netease") return id;
  if (provider === "qq") return `qq:${id}`;
  return `kg:${id}`;
}

/** Map NetEase quality names onto QQ/Kugou `size` values. */
export function qualityToNativeSize(level?: string | null): string {
  const k = String(level || "").toLowerCase().trim();
  if (k === "128k" || k === "320k" || k === "flac" || k === "hires" || k === "master") return k;
  if (k === "standard" || k === "128") return "128k";
  if (k === "exhigh" || k === "higher" || k === "320") return "320k";
  if (k === "lossless" || k === "flac") return "flac";
  if (k === "hires") return "hires";
  if (k === "jymaster" || k === "sky" || k === "jyeffect" || k === "master") return "master";
  return "flac";
}

/** Present QQ/Kugou sizes with the existing NetEase quality labels. */
export function nativeSizeToLevel(size?: string | null): string {
  const k = String(size || "").toLowerCase().trim();
  if (k === "master") return "jymaster";
  if (k === "hires") return "hires";
  if (k === "flac" || k === "ape") return "lossless";
  if (k === "320k" || k === "320") return "exhigh";
  if (k === "128k" || k === "128") return "standard";
  return k || "lossless";
}

export const NATIVE_SIZE_LADDER = ["master", "hires", "flac", "320k", "128k"] as const;
