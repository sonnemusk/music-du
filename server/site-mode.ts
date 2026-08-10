/**
 * Site mode flags (Worker env).
 * Demo: LIBRARY_READONLY=true → public read of library, no writes / export / import.
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
