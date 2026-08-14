import { libraryTokenOk } from "./library-merge.js";

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

/** Public showcase Worker only (`[env.demo]`). Private installs must stay false. */
export function isDemoMode(value: string | boolean | undefined | null): boolean {
  if (value === true) return true;
  const s = String(value ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "demo";
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

/** Node env helper: MUSIC_DEMO_MODE / DEMO_MODE — never on a private install. */
export function envDemoMode(): boolean {
  return isDemoMode(process.env.MUSIC_DEMO_MODE || process.env.DEMO_MODE);
}

/**
 * Library gate: demo readonly blocks writes; optional LIBRARY_TOKEN (Node)
 * protects the whole library surface when set. Empty expected token → allow
 * (local default). Cloudflare Access still covers the Worker hostname.
 */
export function libraryGate(opts: {
  method: string;
  readonly?: boolean;
  expectedToken?: string;
  gotToken?: string;
}): { ok: true } | { ok: false; status: number; error: string; readOnly?: boolean } {
  const readonly = opts.readonly ?? false;
  const method = (opts.method || "GET").toUpperCase();
  if (readonly && method !== "GET" && method !== "HEAD") {
    return { ok: false, status: 403, error: "read-only demo", readOnly: true };
  }
  if (!libraryTokenOk(opts.expectedToken, opts.gotToken)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true };
}
