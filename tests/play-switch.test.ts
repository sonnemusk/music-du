import { describe, expect, it, vi } from "vitest";
import { hardStopAudio, isWarmTrackStale } from "../client/src/store/player.js";

describe("hardStopAudio", () => {
  it("pauses and clears src immediately", () => {
    const pause = vi.fn();
    const load = vi.fn();
    const removeAttribute = vi.fn();
    const audio = {
      pause,
      load,
      removeAttribute,
      src: "https://example.com/old.flac",
    } as unknown as HTMLAudioElement;
    hardStopAudio(audio);
    expect(pause).toHaveBeenCalledTimes(1);
    expect(removeAttribute).toHaveBeenCalledWith("src");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("no-ops on null", () => {
    expect(() => hardStopAudio(null)).not.toThrow();
  });
});

describe("isWarmTrackStale", () => {
  const base = {
    playToken: 3,
    loadingPlay: false,
    playing: false,
    curTrack: { id: "a" },
  };

  it("allows warm when the same idle track is still selected", () => {
    expect(isWarmTrackStale(3, "a", base)).toBe(false);
  });

  it("bails when playTrack has bumped the token or is loading", () => {
    expect(isWarmTrackStale(3, "a", { ...base, playToken: 4 })).toBe(true);
    expect(isWarmTrackStale(3, "a", { ...base, loadingPlay: true })).toBe(true);
    expect(isWarmTrackStale(3, "a", { ...base, playing: true })).toBe(true);
    expect(isWarmTrackStale(3, "a", { ...base, curTrack: { id: "b" } })).toBe(true);
    expect(isWarmTrackStale(3, "a", { ...base, curTrack: null })).toBe(true);
  });
});
