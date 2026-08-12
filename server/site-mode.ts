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
