/**
 * Active lyric line outside the main player store so TrackList / SkinHead
 * do not re-render when the singing line advances.
 */
import { useSyncExternalStore } from "react";

let lyricIdx = -1;
const listeners = new Set<() => void>();

export function getLyricIdx(): number {
  return lyricIdx;
}

export function setLyricIdx(idx: number): void {
  const next = Number.isFinite(idx) ? Math.floor(idx) : -1;
  if (next === lyricIdx) return;
  lyricIdx = next;
  listeners.forEach((l) => l());
}

export function subscribeLyricIdx(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLyricIdx(): number {
  return useSyncExternalStore(subscribeLyricIdx, getLyricIdx, getLyricIdx);
}
