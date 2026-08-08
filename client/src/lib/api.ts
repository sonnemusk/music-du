import type {
  ChartBoard,
  ChartBoardId,
  ChartPayload,
  ChartPlatform,
  ChartPlatformId,
  Library,
  Track,
} from "./types";

async function json<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: "same-origin", ...opts });
  const j = await r.json();
  if (!r.ok && j?.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  if (j?.ok === false) throw new Error(j.error || "request failed");
  return j;
}

export async function searchSongs(q: string, limit = 30): Promise<Track[]> {
  const j = await json(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  return (j.data || []) as Track[];
}

export async function listChartPlatforms(): Promise<ChartPlatform[]> {
  const j = await json("/api/charts");
  return (j.data?.platforms || []) as ChartPlatform[];
}

export async function listChartMeta(): Promise<{
  platforms: ChartPlatform[];
  boards: ChartBoard[];
  defaultBoard: ChartBoardId;
}> {
  const j = await json("/api/charts");
  return {
    platforms: (j.data?.platforms || []) as ChartPlatform[],
    boards: (j.data?.boards || []) as ChartBoard[],
    defaultBoard: (j.data?.defaultBoard || "soar") as ChartBoardId,
  };
}

export async function fetchChart(
  platform: ChartPlatformId | string,
  opts?: { limit?: number; force?: boolean; board?: ChartBoardId | string }
): Promise<ChartPayload> {
  const q = new URLSearchParams();
  if (opts?.limit) q.set("limit", String(opts.limit));
  if (opts?.force) q.set("force", "1");
  if (opts?.board) q.set("board", String(opts.board));
  const qs = q.toString();
  const j = await json(
    `/api/charts/${encodeURIComponent(platform)}${qs ? `?${qs}` : ""}`
  );
  return j.data as ChartPayload;
}

export async function resolveSong(
  id: string | number,
  opts?: { level?: string; force?: boolean }
) {
  const q = new URLSearchParams();
  if (opts?.level) q.set("level", opts.level);
  if (opts?.force) q.set("force", "1");
  const qs = q.toString();
  const j = await json(
    `/api/song/${encodeURIComponent(String(id))}${qs ? `?${qs}` : ""}`
  );
  return j.data;
}

/** Top qualities that actually have a CDN URL for this track (≤3). */
export async function fetchSongQualities(id: string | number, limit = 3) {
  const j = await json(
    `/api/song/${encodeURIComponent(String(id))}/qualities?limit=${limit}`
  );
  return (j.data?.qualities || []) as Array<{
    level: string;
    br: number;
    size: number;
    url: string;
  }>;
}

export async function fetchLyric(
  id: string | number,
  opts?: { name?: string; artist?: string; duration?: number; force?: boolean }
) {
  const q = new URLSearchParams();
  if (opts?.name) q.set("name", opts.name);
  if (opts?.artist) q.set("artist", opts.artist);
  if (opts?.duration) q.set("duration", String(opts.duration));
  if (opts?.force) q.set("force", "1");
  const qs = q.toString();
  const j = await json(
    `/api/lyric/${encodeURIComponent(String(id))}${qs ? `?${qs}` : ""}`
  );
  return j.data as {
    lrc: string;
    tlrc: string;
    source?: string;
    matchedId?: string;
  };
}

export async function loadLibrary(): Promise<Library> {
  const j = await json("/api/library");
  return j.data as Library;
}

export async function saveLibrary(body: any): Promise<Library> {
  const j = await json("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return j.data as Library;
}

export async function deleteFromList(
  list: "playlist" | "favorites" | "history",
  id: string | number
): Promise<Library> {
  const j = await json(`/api/library/${list}/${encodeURIComponent(String(id))}`, {
    method: "DELETE",
  });
  return j.data as Library;
}
