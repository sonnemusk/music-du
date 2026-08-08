import { describe, expect, it } from "vitest";
import {
  cycleRank,
  DEFAULT_QUALITY,
  labelForLevel,
  normalizeChoices,
  pickLevelForRank,
  songCacheKey,
} from "../client/src/lib/quality.js";

describe("quality selection (dynamic top-3)", () => {
  it("defaults to highest intent", () => {
    expect(DEFAULT_QUALITY).toBe("jymaster");
    expect(labelForLevel("jymaster").short).toBe("母带");
    expect(labelForLevel("hires").label).toContain("Hi-Res");
  });

  it("keeps only first three available from ladder order", () => {
    const choices = normalizeChoices([
      { level: "hires", br: 900000, size: 1, url: "https://a/1" },
      { level: "exhigh", br: 320000, size: 1, url: "https://a/2" },
      { level: "standard", br: 128000, size: 1, url: "https://a/3" },
      { level: "higher", br: 192000, size: 1, url: "https://a/4" },
    ]);
    expect(choices.map((c) => c.level)).toEqual([
      "hires",
      "exhigh",
      "standard",
    ]);
  });

  it("rank 0 is best available even without 母带", () => {
    const choices = normalizeChoices([
      { level: "exhigh", br: 320000, url: "https://a/1" },
      { level: "standard", br: 128000, url: "https://a/2" },
    ]);
    expect(pickLevelForRank(choices, 0)).toBe("exhigh");
    expect(pickLevelForRank(choices, 1)).toBe("standard");
    expect(pickLevelForRank(choices, 2)).toBe("standard"); // clamp
    expect(pickLevelForRank([], 0)).toBe("jymaster");
  });

  it("cycles rank within available count", () => {
    expect(cycleRank(0, 3)).toBe(1);
    expect(cycleRank(2, 3)).toBe(0);
    expect(cycleRank(1, 2)).toBe(0);
  });

  it("cache keys include level", () => {
    expect(songCacheKey(42, "hires")).toBe("42@@hires");
  });
});
