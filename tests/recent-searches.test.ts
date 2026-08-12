import { describe, expect, it } from "vitest";
import {
  loadRecentSearches,
  pushRecentSearch,
  saveRecentSearches,
} from "../client/src/lib/recent-searches.js";

describe("recent-searches", () => {
  it("prepends and dedupes case-insensitively", () => {
    expect(pushRecentSearch("周杰伦", ["邓紫棋", "周杰伦"])).toEqual(["周杰伦", "邓紫棋"]);
    expect(pushRecentSearch("JAY", ["jay", "a"])).toEqual(["JAY", "a"]);
  });

  it("caps at 10", () => {
    const existing = Array.from({ length: 10 }, (_, i) => `q${i}`);
    const next = pushRecentSearch("new", existing);
    expect(next).toHaveLength(10);
    expect(next[0]).toBe("new");
    expect(next).not.toContain("q9");
  });

  it("ignores empty query", () => {
    expect(pushRecentSearch("  ", ["a"])).toEqual(["a"]);
  });

  it("round-trips storage", () => {
    const mem: Record<string, string> = {};
    const storage = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
    };
    saveRecentSearches(["a", "b"], storage);
    expect(loadRecentSearches(storage)).toEqual(["a", "b"]);
  });
});
