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
 * Q-2: library gate for Node (and tests).
 * - readonly → GET ok, write forbidden
 * - MUSIC_ACCESS_TOKEN set → require matching X-Music-Token (or Authorization Bearer)
 * - token unset → allow (local dev) unless requireToken=true
 */
export function libraryGate(opts: {
  method: string;
  tokenHeader?: string | null;
  authHeader?: string | null;
  expectedToken?: string | null;
  readonly?: boolean;
  requireToken?: boolean;
}): { ok: true } | { ok: false; status: number; error: string; readOnly?: boolean } {
  const readonly = opts.readonly ?? false;
  const method = (opts.method || "GET").toUpperCase();
  if (readonly && method !== "GET" && method !== "HEAD") {
    return { ok: false, status: 403, error: "read-only demo", readOnly: true };
  }
  const expected = (opts.expectedToken || "").trim();
  if (!expected) {
    if (opts.requireToken) {
      return { ok: false, status: 503, error: "MUSIC_ACCESS_TOKEN not configured" };
    }
    return { ok: true };
  }
  let got = (opts.tokenHeader || "").trim();
  if (!got && opts.authHeader) {
    const m = /^Bearer\s+(.+)$/i.exec(opts.authHeader.trim());
    if (m) got = m[1].trim();
  }
  // reuse timing-safe from library-merge via dynamic simple check length first
  if (!got || got.length !== expected.length) {
    return { ok: false, status: 401, error: "unauthorized — set X-Music-Token" };
  }
  let x = 0;
  for (let i = 0; i < expected.length; i++) x |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  if (x !== 0) {
    return { ok: false, status: 401, error: "unauthorized — set X-Music-Token" };
  }
  return { ok: true };
}
