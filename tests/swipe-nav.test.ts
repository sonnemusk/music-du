import { describe, expect, it } from "vitest";
import {
  SWIPE_DX_OVER_DY,
  SWIPE_DY_OVER_DX,
  SWIPE_MIN_DX,
  SWIPE_MIN_DY,
  resolveSwipe,
  resolveVerticalSwipe,
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

describe("cover vertical swipe", () => {
  it("maps up to next and down to previous", () => {
    expect(SWIPE_MIN_DY).toBe(56);
    expect(SWIPE_DY_OVER_DX).toBe(1.25);
    expect(resolveVerticalSwipe(0, -70)).toBe("up");
    expect(resolveVerticalSwipe(8, 80)).toBe("down");
  });

  it("rejects short or sideways motion so a tap can still flip lyrics", () => {
    expect(resolveVerticalSwipe(0, -40)).toBeNull();
    expect(resolveVerticalSwipe(80, -50)).toBeNull();
    expect(resolveVerticalSwipe(-90, 10)).toBeNull();
  });
});
