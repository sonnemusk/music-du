import * as chksz from "./chksz.js";
import type { PlaySource } from "./types.js";

export function chooseAudioSrc(
  meta: { url?: string },
  streamPath: string
): { src: string; mode: "remote" | "stream"; fallback: string | null } {
  const url = meta?.url || "";
  if (typeof url === "string" && /^https?:\/\//i.test(url)) {
    return { src: url, mode: "remote", fallback: streamPath };
  }
  return { src: streamPath, mode: "stream", fallback: null };
}

export function onRemoteError(streamPath: string) {
  return { src: streamPath, mode: "stream" as const, fallback: null };
}

export async function resolvePlay(
  sid: string | number,
  level?: string | null,
  opts?: { apikey?: string }
): Promise<PlaySource> {
  const id = String(sid);
  const raw = await chksz.fetchMusic(id, level, opts);
  if (raw && chksz.isRemoteUrl(raw.url || "")) {
    return {
      source: "remote",
      url: raw.url,
      level: String(raw.level || raw._requested_level || ""),
      br: Number(raw.br || 0),
      size: Number(raw.size || 0),
      name: String(raw.name || ""),
      artist: String(raw.artist || ""),
      cover: chksz.tryHttps(String(raw.picUrl || raw.cover || "")),
      sid: id,
      meta: raw,
    };
  }
  return {
    source: raw && Object.keys(raw).length ? "stream" : "none",
    url: `/api/stream/${id}`,
    level: String((raw || {}).level || (raw || {})._requested_level || ""),
    br: Number((raw || {}).br || 0),
    size: Number((raw || {}).size || 0),
    name: String((raw || {}).name || ""),
    artist: String((raw || {}).artist || ""),
    cover: chksz.tryHttps(String((raw || {}).picUrl || (raw || {}).cover || "")),
    sid: id,
    meta: raw && Object.keys(raw).length ? raw : null,
  };
}
