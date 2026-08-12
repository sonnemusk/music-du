import { describe, expect, it } from "vitest";
import {
  isLibraryReadonly,
  publicReadonlyLibraryData,
} from "../server/site-mode.js";

describe("site-mode", () => {
  it("detects readonly flags", () => {
    expect(isLibraryReadonly("true")).toBe(true);
    expect(isLibraryReadonly("1")).toBe(true);
    expect(isLibraryReadonly("YES")).toBe(true);
    expect(isLibraryReadonly("demo")).toBe(true);
    expect(isLibraryReadonly("readonly")).toBe(true);
    expect(isLibraryReadonly(true)).toBe(true);
  });

  it("private default is writable", () => {
    expect(isLibraryReadonly(undefined)).toBe(false);
    expect(isLibraryReadonly("")).toBe(false);
    expect(isLibraryReadonly("false")).toBe(false);
    expect(isLibraryReadonly("0")).toBe(false);
  });

  it("readonly public GET strips history and curIdx (C2)", () => {
    const full = {
      playlist: [{ id: 1, name: "a" }],
      favorites: [{ id: 2, name: "b" }],
      history: [{ id: 3, name: "c" }],
      curIdx: 7,
      revision: 42,
    };
    const pub = publicReadonlyLibraryData(full);
    expect(pub.favorites).toEqual(full.favorites);
    expect(pub.playlist).toEqual(full.playlist);
    expect(pub.revision).toBe(42);
    expect(pub).not.toHaveProperty("history");
    expect(pub).not.toHaveProperty("curIdx");
    // original unchanged
    expect(full.history).toHaveLength(1);
    expect(full.curIdx).toBe(7);
  });
});
