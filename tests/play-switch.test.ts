import { describe, expect, it, vi } from "vitest";
import { hardStopAudio } from "../client/src/store/player.js";

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
