/** Narrow / phone chrome for search IA (scheme B). Desktop keeps header SearchBar. */
export const MOBILE_SEARCH_MQ = "(max-width: 720px)";

export function isMobileSearchUi(
  matchMediaFn: (q: string) => { matches: boolean } | null = typeof window !== "undefined"
    ? (q) => window.matchMedia(q)
    : () => null
): boolean {
  try {
    return Boolean(matchMediaFn(MOBILE_SEARCH_MQ)?.matches);
  } catch {
    return false;
  }
}
