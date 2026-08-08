/**
 * User-selectable audio quality — top 3 from NetEase / ChKSz ladder.
 * Default is highest (jymaster). Server still falls through lower tiers
 * if the preferred level has no URL.
 */

export type QualityId = "jymaster" | "sky" | "jyeffect";

export type QualityOption = {
  id: QualityId;
  /** Short UI label */
  short: string;
  /** Full name for toast / title */
  label: string;
  /** Hint under picker */
  hint: string;
};

/** Rank order: best first */
export const QUALITY_OPTIONS: readonly QualityOption[] = [
  {
    id: "jymaster",
    short: "母带",
    label: "超清母带",
    hint: "最高 · jymaster",
  },
  {
    id: "sky",
    short: "沉浸",
    label: "沉浸环绕",
    hint: "次高 · sky",
  },
  {
    id: "jyeffect",
    short: "高清",
    label: "高清环绕",
    hint: "第三 · jyeffect",
  },
] as const;

export const DEFAULT_QUALITY: QualityId = "jymaster";

export const QUALITY_LS_KEY = "kazam.v2.preferredQuality";

export function isQualityId(v: unknown): v is QualityId {
  return (
    v === "jymaster" || v === "sky" || v === "jyeffect"
  );
}

export function loadPreferredQuality(): QualityId {
  try {
    const raw = localStorage.getItem(QUALITY_LS_KEY);
    if (isQualityId(raw)) return raw;
  } catch {
    /* */
  }
  return DEFAULT_QUALITY;
}

export function savePreferredQuality(q: QualityId): void {
  try {
    localStorage.setItem(QUALITY_LS_KEY, q);
  } catch {
    /* */
  }
}

export function qualityOption(id: string | null | undefined): QualityOption {
  const hit = QUALITY_OPTIONS.find((o) => o.id === id);
  return hit || QUALITY_OPTIONS[0];
}

export function qualityShortLabel(id: string | null | undefined): string {
  if (!id || id === "…" || id === "缓存") return id || "";
  const hit = QUALITY_OPTIONS.find((o) => o.id === id);
  if (hit) return hit.short;
  // API may return other levels (hires, lossless…) — show uppercased
  return String(id).toUpperCase();
}

/** Cycle jymaster → sky → jyeffect → jymaster */
export function cycleQuality(current: QualityId): QualityId {
  const i = QUALITY_OPTIONS.findIndex((o) => o.id === current);
  const next = QUALITY_OPTIONS[(i + 1) % QUALITY_OPTIONS.length];
  return next.id;
}

/** Cache key must include preferred level so switching re-resolves */
export function songCacheKey(id: string | number, level: string): string {
  return `${String(id)}@@${level || DEFAULT_QUALITY}`;
}
