import { describe, expect, it } from "vitest";
import {
  SWIPE_DX_OVER_DY,
  SWIPE_MIN_DX,
  resolveSwipe,
} from "../client/src/lib/swipe-nav.js";

describe("swipe-nav M-11", () => {
  it("exports stricter thresholds", () => {
    expect(SWIPE_MIN_DX).toBeGreaterThanOrEqual(60);
    expect(SWIPE_DX_OVER_DY).toBeGreaterThanOrEqual(2);
  });

  it("accepts clear horizontal swipes", () => {
    expect(resolveSwipe(-80, 5)).toBe("left");
    expect(resolveSwipe(90, -10)).toBe("right");
  });

  it("rejects short or diagonal-ish motion", () => {
    expect(resolveSwipe(-40, 0)).toBeNull();
    expect(resolveSwipe(-60, 40)).toBeNull(); // |dx| <= 2|dy|
    expect(resolveSwipe(100, 60)).toBeNull();
  });
});
