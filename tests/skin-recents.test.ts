import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSkinRecents, pushSkinRecent } from "../client/src/lib/skin-recents.js";

const mem = new Map<string, string>();

beforeEach(() => {
  mem.clear();
  const store = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
});

afterEach(() => {
  mem.clear();
});

describe("skin recents", () => {
  it("stores newest first and drops duplicates", () => {
    expect(loadSkinRecents()).toEqual([]);
    expect(pushSkinRecent("stage-dim")).toEqual(["stage-dim"]);
    expect(pushSkinRecent("gallery-pale")).toEqual(["gallery-pale", "stage-dim"]);
    expect(pushSkinRecent("stage-dim")).toEqual(["stage-dim", "gallery-pale"]);
  });

  it("caps at six", () => {
    for (let i = 0; i < 8; i++) pushSkinRecent(`t${i}`);
    expect(loadSkinRecents()).toHaveLength(6);
    expect(loadSkinRecents()[0]).toBe("t7");
  });
});
