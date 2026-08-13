/**
 * Site mode flags (Worker env).
 * Demo: LIBRARY_READONLY=true → public read of library, no writes / export / import.
 *
 * C2 public GET: favorites (and playlist/revision) may ship; history + curIdx are stripped.
 */

export function isLibraryReadonly(
  value: string | boolean | undefined | null
): boolean {
  if (value === true) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "readonly" || s === "demo";
}

/** Library snapshot shape returned by loadLib / client hydrators. */
export type LibrarySnapshot = {
  playlist?: unknown[];
  favorites?: unknown[];
  history?: unknown[];
  curIdx?: number;
  revision?: number | string;
  [k: string]: unknown;
};

/**
 * Readonly / demo public GET: drop private playback state (history, curIdx).
 * Favorites (and playlist if present) remain so the demo can show a real library.
 */
export function publicReadonlyLibraryData<T extends LibrarySnapshot>(
  data: T
): Omit<T, "history" | "curIdx"> {
  const { history: _h, curIdx: _c, ...rest } = data;
  return rest;
}

/** Node env helper: MUSIC_LIBRARY_READONLY / LIBRARY_READONLY */
export function envLibraryReadonly(): boolean {
  return isLibraryReadonly(
    process.env.MUSIC_LIBRARY_READONLY || process.env.LIBRARY_READONLY
  );
}

/**
 * Library mutations: demo readonly is the only app-layer gate.
 * Private installs rely on Cloudflare Access at the edge.
 */
export function libraryGate(opts: {
  method: string;
  readonly?: boolean;
}): { ok: true } | { ok: false; status: number; error: string; readOnly?: boolean } {
  const readonly = opts.readonly ?? false;
  const method = (opts.method || "GET").toUpperCase();
  if (readonly && method !== "GET" && method !== "HEAD") {
    return { ok: false, status: 403, error: "read-only demo", readOnly: true };
  }
  return { ok: true };
}
