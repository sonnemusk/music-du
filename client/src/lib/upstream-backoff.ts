/**
 * Simple client-side backoff when ChKSz / BFF rate-limits (429) or fails hard.
 * Free-tier only — no CF paid queues.
 */

let blockedUntil = 0;
let streak = 0;

export function upstreamBlockedMs(): number {
  return Math.max(0, blockedUntil - Date.now());
}

export function isUpstreamBlocked(): boolean {
  return Date.now() < blockedUntil;
}

/** Call after a successful upstream-facing request. */
export function noteUpstreamOk() {
  streak = 0;
  blockedUntil = 0;
}

/**
 * Call when resolve/search hits 429 or 5xx.
 * Backoff: 2s, 4s, 8s… capped at 60s.
 */
export function noteUpstreamError(status?: number) {
  if (status != null && status !== 429 && status < 500) return;
  streak = Math.min(streak + 1, 6);
  const ms = Math.min(60_000, 2000 * Math.pow(2, streak - 1));
  blockedUntil = Date.now() + ms;
}

/** Wait until backoff window ends (no-op if clear). */
export async function waitUpstreamSlot(signal?: AbortSignal): Promise<boolean> {
  const left = upstreamBlockedMs();
  if (left <= 0) return true;
  await new Promise<void>((resolve) => {
    const t = window.setTimeout(() => resolve(), left);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
  return !signal?.aborted;
}
