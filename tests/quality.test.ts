import { describe, expect, it } from "vitest";
import {
  cycleQuality,
  DEFAULT_QUALITY,
  isQualityId,
  QUALITY_OPTIONS,
  qualityOption,
  songCacheKey,
} from "../client/src/lib/quality.js";

describe("quality selection", () => {
  it("exposes top-3 levels with jymaster default", () => {
    expect(QUALITY_OPTIONS).toHaveLength(3);
    expect(DEFAULT_QUALITY).toBe("jymaster");
    expect(QUALITY_OPTIONS[0].id).toBe("jymaster");
    expect(QUALITY_OPTIONS[1].id).toBe("sky");
    expect(QUALITY_OPTIONS[2].id).toBe("jyeffect");
  });

  it("cycles quality rank order", () => {
    expect(cycleQuality("jymaster")).toBe("sky");
    expect(cycleQuality("sky")).toBe("jyeffect");
    expect(cycleQuality("jyeffect")).toBe("jymaster");
  });

  it("labels and cache keys", () => {
    expect(qualityOption("sky").label).toContain("沉浸");
    expect(isQualityId("hires")).toBe(false);
    expect(songCacheKey(42, "jymaster")).toBe("42@@jymaster");
  });
});
