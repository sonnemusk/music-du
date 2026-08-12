/**
 * Recent search keywords (local only). Used by mobile SearchOverlay (M-2 / F-10a).
 */

export const RECENT_SEARCHES_KEY = "music-du.recent-searches";
export const RECENT_SEARCHES_MAX = 10;

export function loadRecentSearches(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined" ? localStorage : null
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .slice(0, RECENT_SEARCHES_MAX);
  } catch {
    return [];
  }
}

/** Prepend query; dedupe case-insensitively; cap list. */
export function pushRecentSearch(
  query: string,
  existing: string[] = [],
  max = RECENT_SEARCHES_MAX
): string[] {
  const q = query.trim();
  if (!q) return existing.slice(0, max);
  const lower = q.toLowerCase();
  const rest = existing.filter((x) => x.trim().toLowerCase() !== lower);
  return [q, ...rest].slice(0, max);
}

export function saveRecentSearches(
  list: string[],
  storage: Pick<Storage, "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null
): void {
  if (!storage) return;
  try {
    storage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, RECENT_SEARCHES_MAX)));
  } catch {
    /* quota / private mode */
  }
}

export function recordRecentSearch(query: string): string[] {
  const next = pushRecentSearch(query, loadRecentSearches());
  saveRecentSearches(next);
  return next;
}
