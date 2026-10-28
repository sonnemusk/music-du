import { describe, expect, it } from "vitest";
import {
  resetPruneScheduleForTests,
  shouldPruneResolveCache,
} from "../server/resolve-cache.js";

describe("resolve cache prune gate", () => {
  it("scans at most once per half hour in an isolate", () => {
    resetPruneScheduleForTests();
    expect(shouldPruneResolveCache(1_000)).toBe(true);
    expect(shouldPruneResolveCache(1_001)).toBe(false);
    expect(shouldPruneResolveCache(1_000 + 30 * 60 * 1000 - 1)).toBe(false);
    expect(shouldPruneResolveCache(1_000 + 30 * 60 * 1000)).toBe(true);
  });
});
