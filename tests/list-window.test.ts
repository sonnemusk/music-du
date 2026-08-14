import { describe, expect, it } from "vitest";
import { visibleWindow } from "../client/src/lib/list-window.js";

describe("visibleWindow", () => {
  it("returns an empty slice for an empty list", () => {
    expect(visibleWindow({ length: 0, scrollTop: 0, viewportH: 400, rowH: 56 })).toEqual({
      start: 0,
      end: 0,
      padTop: 0,
      padBottom: 0,
    });
  });

  it("windows a long list with overscan", () => {
    const w = visibleWindow({
      length: 500,
      scrollTop: 56 * 20,
      viewportH: 560,
      rowH: 56,
      overscan: 2,
    });
    expect(w.start).toBe(18);
    expect(w.end).toBe(32);
    expect(w.padTop).toBe(18 * 56);
    expect(w.padBottom).toBe((500 - 32) * 56);
  });

  it("clamps to the list bounds", () => {
    const w = visibleWindow({
      length: 10,
      scrollTop: 0,
      viewportH: 2000,
      rowH: 56,
      overscan: 8,
    });
    expect(w.start).toBe(0);
    expect(w.end).toBe(10);
    expect(w.padBottom).toBe(0);
  });
});
