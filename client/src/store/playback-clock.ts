/**
 * F-1: high-frequency playback clock outside the main player store
 * so TrackList / SkinHead do not re-render on timeupdate.
 */
import { useSyncExternalStore } from "react";

export type PlaybackClock = {
  currentTime: number;
  duration: number;
  buffered: number;
  playing: boolean;
};

let clock: PlaybackClock = {
  currentTime: 0,
  duration: 0,
  buffered: 0,
  playing: false,
};

const listeners = new Set<() => void>();

export function getPlaybackClock(): PlaybackClock {
  return clock;
}

export function setPlaybackClock(partial: Partial<PlaybackClock>): void {
  const next = { ...clock, ...partial };
  if (
    next.currentTime === clock.currentTime &&
    next.duration === clock.duration &&
    next.buffered === clock.buffered &&
    next.playing === clock.playing
  ) {
    return;
  }
  clock = next;
  listeners.forEach((l) => l());
}

export function subscribePlaybackClock(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePlaybackClock(): PlaybackClock;
export function usePlaybackClock<T>(selector: (c: PlaybackClock) => T): T;
export function usePlaybackClock<T>(selector?: (c: PlaybackClock) => T): T | PlaybackClock {
  return useSyncExternalStore(
    subscribePlaybackClock,
    () => (selector ? selector(clock) : clock),
    () => (selector ? selector(clock) : clock)
  );
}
