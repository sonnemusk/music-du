import { t } from "../i18n";
import type {
  ChartBoard,
  ChartBoardId,
  ChartPayload,
  ChartPlatform,
  ChartPlatformId,
  Library,
  Track,
} from "./types";

function withAuthHeaders(init?: RequestInit): RequestInit {
  return { credentials: "same-origin", ...init };
}

function accessLoginHint(): string {
  return t("access.loginHint");
}

async function json<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(path, withAuthHeaders(opts));
  const ct = r.headers.get("content-type") || "";
  // Session expired / whole-site Access — HTML login page instead of JSON
  if (ct.includes("text/html") || r.status === 302) {
    throw new Error(accessLoginHint());
  }
  let j: any;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  if (r.status === 401) {
    // Access challenge sometimes surfaces as 401 JSON/HTML
    const msg = j?.error || "";
    if (!msg || /access|cloudflare|login/i.test(msg)) {
      throw new Error(accessLoginHint());
    }
    throw new Error(msg || t("access.denied"));
  }
  if (r.status === 429) {
    throw new Error(j?.error || "HTTP 429 rate limited");
  }
  if (!r.ok && j?.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  if (j?.ok === false) throw new Error(j.error || "request failed");
  return j as T;
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
  // Always bypass edge/D1 when force — signed CDN URLs expire
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

export class LibraryConflictError extends Error {
  data: Library;
  constructor(message: string, data: Library) {
    super(message);
    this.name = "LibraryConflictError";
    this.data = data;
  }
}

async function libraryJson(path: string, opts?: RequestInit): Promise<Library> {
  const r = await fetch(path, withAuthHeaders(opts));
  let j: any;
  try {
    j = await r.json();
  } catch {
    j = null;
  }
  if (r.status === 409 && j?.data) {
    throw new LibraryConflictError(
      j.error || "library conflict",
      j.data as Library
    );
  }
  if (r.status === 401) {
    throw new Error(j?.error || t("access.denied"));
  }
  if (!r.ok && j?.ok === false) throw new Error(j.error || `HTTP ${r.status}`);
  if (j?.ok === false) throw new Error(j.error || "request failed");
  return j.data as Library;
}

export async function loadLibrary(): Promise<Library> {
  return libraryJson("/api/library");
}

/** Site flags from /api/health (demo read-only etc.). */
export async function fetchSiteFlags(): Promise<{ readOnly: boolean }> {
  try {
    const r = await fetch("/api/health", { credentials: "same-origin" });
    const j = (await r.json().catch(() => null)) as {
      readOnly?: boolean;
      policy?: { library_readonly?: boolean };
    } | null;
    return {
      readOnly: Boolean(j?.readOnly || j?.policy?.library_readonly),
    };
  } catch {
    return { readOnly: false };
  }
}

export async function saveLibrary(body: any): Promise<Library> {
  return libraryJson("/api/library", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteFromList(
  list: "playlist" | "favorites" | "history",
  id: string | number,
  revision?: number | null
): Promise<Library> {
  const q =
    revision != null && Number.isFinite(revision)
      ? `?revision=${encodeURIComponent(String(revision))}`
      : "";
  return libraryJson(
    `/api/library/${list}/${encodeURIComponent(String(id))}${q}`,
    { method: "DELETE" }
  );
}
