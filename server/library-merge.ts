/**
 * Pure library list merge — shared by Worker D1 path + unit tests.
 * Prevents a thin client payload from wiping a richer server list
 * unless forceClear is set.
 */

export type LibTrack = {
  id?: string | number;
  sid?: string | number;
  name?: string;
  artist?: string;
  album?: string;
  cover?: string;
  duration?: number;
  [k: string]: unknown;
};

function trackId(t: LibTrack | null | undefined): string {
  if (!t) return "";
  const id = t.id ?? t.sid;
  if (id == null || id === "") return "";
  return String(id);
}

function normalizeId(id: string): string | number {
  return /^\d+$/.test(id) ? Number(id) : id;
}

/**
 * Merge incoming client list with existing server rows.
 * - forceClear: take incoming only (may be empty)
 * - else: incoming order first, then append server-only rows
 */
export function mergeTrackList(
  existing: LibTrack[],
  incoming: LibTrack[] | undefined,
  forceClear: boolean,
  cap: number
): LibTrack[] {
  if (forceClear) {
    const out: LibTrack[] = [];
    const seen = new Set<string>();
    for (const t of incoming || []) {
      const k = trackId(t);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({ ...t, id: normalizeId(k) });
      if (out.length >= cap) break;
    }
    return out;
  }
  if (!incoming?.length) return existing || [];
  const out: LibTrack[] = [];
  const seen = new Set<string>();
  for (const t of incoming) {
    const k = trackId(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ ...t, id: normalizeId(k) });
    if (out.length >= cap) break;
  }
  for (const t of existing || []) {
    if (out.length >= cap) break;
    const k = trackId(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push({ ...t, id: normalizeId(k) });
  }
  return out;
}

/** Sanitize one track for D1 write planning. */
export function sanitizeLibTrack(t: any): LibTrack | null {
  if (!t || t.id == null || t.id === "") return null;
  return {
    id: t.id,
    name: String(t.name || ""),
    artist: String(t.artist || ""),
    album: String(t.album || ""),
    cover: String(t.cover || ""),
    duration: Number(t.duration || 0) || 0,
    level: String(t.level || ""),
    br: Number(t.br || 0),
    size: Number(t.size || 0),
  };
}

/**
 * Plan upsert order for a list rewrite (no DB).
 * Mirrors Worker writeList: unique by id, capped, stable pos 0..n-1.
 */
export function planListUpserts(
  tracks: any[] | undefined,
  cap: number
): { sid: string; pos: number; track: LibTrack }[] {
  const seen = new Set<string>();
  const out: { sid: string; pos: number; track: LibTrack }[] = [];
  let pos = 0;
  for (const raw of tracks || []) {
    const t = sanitizeLibTrack(raw);
    if (!t) continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    if (pos >= cap) break;
    out.push({ sid: k, pos, track: t });
    pos++;
  }
  return out;
}

/** Library token check (pure). Empty expected → allow (local/dev). */
export function libraryTokenOk(expected: string | undefined, got: string | undefined): boolean {
  const exp = (expected || "").trim();
  if (!exp) return true;
  return Boolean(got && got.trim() === exp);
}

/**
 * Optimistic concurrency: client sends revision it last loaded.
 * - clientRev missing / null → allow (legacy clients), still bump server
 * - clientRev === serverRev → allow
 * - else conflict
 */
export function libraryRevisionOk(
  serverRev: number,
  clientRev: number | null | undefined
): boolean {
  if (clientRev == null || Number.isNaN(Number(clientRev))) return true;
  return Number(clientRev) === Number(serverRev);
}

export function nextLibraryRevision(serverRev: number): number {
  const n = Number(serverRev);
  if (!Number.isFinite(n) || n < 0) return 1;
  return Math.floor(n) + 1;
}

/** Same track ids in same order (ignores metadata). Used to skip no-op D1 rewrites. */
export function trackListSameIds(
  a: Array<{ id?: string | number } | null | undefined> | null | undefined,
  b: Array<{ id?: string | number } | null | undefined> | null | undefined
): boolean {
  const aa = a || [];
  const bb = b || [];
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (String(aa[i]?.id ?? "") !== String(bb[i]?.id ?? "")) return false;
  }
  return true;
}

/** Id sets equal (order-insensitive) — detect real multi-device fav/pl drift. */
export function trackIdSetsEqual(
  a: Array<{ id?: string | number } | null | undefined> | null | undefined,
  b: Array<{ id?: string | number } | null | undefined> | null | undefined
): boolean {
  const A = new Set(
    (a || []).map((t) => String(t?.id ?? "")).filter(Boolean)
  );
  const B = new Set(
    (b || []).map((t) => String(t?.id ?? "")).filter(Boolean)
  );
  if (A.size !== B.size) return false;
  for (const id of A) if (!B.has(id)) return false;
  return true;
}

/**
 * Union two track lists by id: prefer primary order, then append secondary-only.
 * Used at bootstrap to reconcile localStorage with D1 without thin-client wipe.
 */
export function unionTracksById<T extends LibTrack>(
  primary: T[],
  secondary: T[]
): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const t of primary || []) {
    const k = trackId(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  for (const t of secondary || []) {
    const k = trackId(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
