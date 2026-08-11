/**
 * Audio quality:
 * - Ladder is high→low (母带 first).
 * - Per track we only offer the top 3 levels that **actually have a URL**.
 * - User preference is a rank 0/1/2 among those available (default 0 = highest).
 *   So if a song has no 母带, rank 0 becomes whatever is best for that song.
 */
import { getLocale, t, type Locale } from "../i18n";

export type QualityRank = 0 | 1 | 2;

export type QualityChoice = {
  level: string;
  br: number;
  size: number;
  url?: string;
  short: string;
  label: string;
};

const LEVEL_IDS = [
  "jymaster",
  "sky",
  "jyeffect",
  "hires",
  "lossless",
  "exhigh",
  "higher",
  "standard",
] as const;

/**
 * Default quality = rank 1 (second of top-3), e.g. 沉浸/sky when available.
 * Rank 0 is highest (母带); we prefer one step down for bandwidth by default.
 */
export const DEFAULT_QUALITY_RANK: QualityRank = 1;
/** Intent level for pre-resolve when ladder unknown (matches DEFAULT_QUALITY_RANK). */
export const DEFAULT_QUALITY = "sky";

export const QUALITY_RANK_KEY = "kazam.v2.qualityRank";

export function labelForLevel(
  level: string | null | undefined,
  locale: Locale = getLocale()
): {
  short: string;
  label: string;
} {
  const k = String(level || "").toLowerCase();
  if ((LEVEL_IDS as readonly string[]).includes(k)) {
    return {
      short: t(`quality.levels.${k}.short`, undefined, locale),
      label: t(`quality.levels.${k}.label`, undefined, locale),
    };
  }
  if (!k) {
    return {
      short: t("quality.autoShort", undefined, locale),
      label: t("quality.autoLabel", undefined, locale),
    };
  }
  return { short: k.toUpperCase().slice(0, 4), label: k.toUpperCase() };
}

export function normalizeChoices(
  raw: Array<{ level?: string; br?: number; size?: number; url?: string }> | null | undefined
): QualityChoice[] {
  if (!raw?.length) return [];
  const out: QualityChoice[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const level = String(r.level || "").trim();
    if (!level || seen.has(level)) continue;
    seen.add(level);
    const lab = labelForLevel(level);
    out.push({
      level,
      br: Number(r.br || 0),
      size: Number(r.size || 0),
      url: r.url && /^https?:\/\//i.test(r.url) ? r.url : undefined,
      short: lab.short,
      label: lab.label,
    });
    if (out.length >= 3) break;
  }
  return out;
}

export function loadPreferredRank(): QualityRank {
  try {
    const n = Number(localStorage.getItem(QUALITY_RANK_KEY));
    if (n === 0 || n === 1 || n === 2) return n;
    // migrate old preferred level names → rank intent
    const old = localStorage.getItem("kazam.v2.preferredQuality");
    if (old === "jymaster") return 0;
    if (old === "sky") return 1;
    if (old === "jyeffect") return 2;
  } catch {
    /* */
  }
  return DEFAULT_QUALITY_RANK;
}

export function savePreferredRank(rank: QualityRank): void {
  try {
    localStorage.setItem(QUALITY_RANK_KEY, String(rank));
  } catch {
    /* */
  }
}

/**
 * Sticky intent level when we don't yet know a song's real ladder.
 * Rank 0/1/2 map to the global top-3 names so UI never flashes "母带" for a rank-1 user.
 */
export function intentLevelForRank(rank: QualityRank): string {
  if (rank === 1) return "sky";
  if (rank === 2) return "jyeffect";
  return "jymaster"; // rank 0 = highest ladder intent
}

/** Pick level for play: rank among available; empty → sticky intent for that rank. */
export function pickLevelForRank(
  choices: QualityChoice[],
  rank: QualityRank
): string {
  if (!choices.length) return intentLevelForRank(rank);
  const i = Math.min(Math.max(0, rank), choices.length - 1);
  return choices[i].level;
}

export function cycleRank(rank: QualityRank, choiceCount: number): QualityRank {
  const n = Math.max(1, Math.min(3, choiceCount || 3));
  return ((rank + 1) % n) as QualityRank;
}

export function qualityShortLabel(id: string | null | undefined): string {
  if (!id || id === "…" || id === "缓存") return id || "";
  return labelForLevel(id).short;
}

export function songCacheKey(id: string | number, level: string): string {
  return `${String(id)}@@${level || DEFAULT_QUALITY}`;
}

/** @deprecated fixed top-3 — kept for any leftover imports during transition */
export type QualityId = string;
export const QUALITY_OPTIONS = [
  { id: "jymaster", short: "母带", label: "超清母带", hint: "最高" },
  { id: "sky", short: "沉浸", label: "沉浸环绕", hint: "次高" },
  { id: "jyeffect", short: "高清", label: "高清环绕", hint: "第三" },
] as const;
export function qualityOption(id: string | null | undefined) {
  const lab = labelForLevel(id || DEFAULT_QUALITY);
  return { id: id || DEFAULT_QUALITY, short: lab.short, label: lab.label, hint: lab.label };
}
export function isQualityId(_v: unknown): boolean {
  return true;
}
export function loadPreferredQuality(): string {
  const rank = loadPreferredRank();
  return rank === 1 ? "sky" : rank === 2 ? "jyeffect" : "jymaster";
}
export function savePreferredQuality(q: string): void {
  if (q === "sky") savePreferredRank(1);
  else if (q === "jyeffect") savePreferredRank(2);
  else savePreferredRank(0);
}
export function cycleQuality(current: string): string {
  if (current === "jymaster") return "sky";
  if (current === "sky") return "jyeffect";
  return "jymaster";
}
