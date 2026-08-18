const KEY = "kazam.v2.skinRecents";
const MAX = 6;

export function loadSkinRecents(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(String).filter(Boolean).slice(0, MAX);
  } catch {
    return [];
  }
}

/** Newest first, unique, capped. */
export function pushSkinRecent(id: string): string[] {
  const next = [id, ...loadSkinRecents().filter((x) => x !== id)].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* */
  }
  return next;
}
