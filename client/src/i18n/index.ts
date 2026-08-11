import { useMemo } from "react";
import { en } from "./en";
import type { Dict, Locale } from "./types";
import { zh } from "./zh";

export type { Locale } from "./types";

const DICTS: Record<Locale, Dict> = { zh, en };

export const LOCALE_KEY = "kazam.v2.locale";

let current: Locale = "zh";

export function isLocale(v: unknown): v is Locale {
  return v === "zh" || v === "en";
}

export function getLocale(): Locale {
  return current;
}

export function initLocaleFromStorage(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_KEY);
    if (isLocale(raw)) current = raw;
  } catch {
    /* */
  }
  applyDocumentLang(current);
  return current;
}

export function setLocaleModule(locale: Locale) {
  current = locale;
  applyDocumentLang(locale);
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* */
  }
}

function applyDocumentLang(locale: Locale) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
}

function lookup(dict: Dict, key: string): string | undefined {
  const parts = key.split(".");
  let cur: string | Dict | undefined = dict;
  for (const p of parts) {
    if (cur == null || typeof cur === "string") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** Translate by dotted key. Falls back to zh, then key. */
export function t(
  key: string,
  vars?: Record<string, string | number>,
  locale: Locale = current
): string {
  let s =
    lookup(DICTS[locale], key) ??
    (locale !== "zh" ? lookup(DICTS.zh, key) : undefined) ??
    key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

/** React hook — re-render when `locale` from store changes. */
export function useT(locale: Locale) {
  return useMemo(
    () => (key: string, vars?: Record<string, string | number>) => t(key, vars, locale),
    [locale]
  );
}
