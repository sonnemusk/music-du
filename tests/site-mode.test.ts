import { describe, expect, it } from "vitest";
import { isLibraryReadonly } from "../server/site-mode.js";

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
});
