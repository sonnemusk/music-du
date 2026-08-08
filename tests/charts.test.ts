import { describe, expect, it } from "vitest";
import {
  isChartBoard,
  isChartPlatform,
  listChartBoards,
  listChartPlatforms,
  normalizeBoard,
  resolveSource,
  _clearChartCache,
} from "../server/charts.js";

describe("charts catalog", () => {
  it("lists platforms including douyin and extras", () => {
    const list = listChartPlatforms();
    expect(list.length).toBeGreaterThanOrEqual(7);
    expect(list.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        "douyin",
        "network",
        "netease",
        "qq",
        "kugou",
        "kuwo",
        "index",
        "original",
      ])
    );
  });

  it("has soar/hot/new boards", () => {
    const boards = listChartBoards();
    expect(boards.map((b) => b.id)).toEqual(
      expect.arrayContaining(["soar", "hot", "new"])
    );
    expect(isChartBoard("soar")).toBe(true);
  });

  it("validates platform ids and board fallbacks", () => {
    expect(isChartPlatform("douyin")).toBe(true);
    expect(isChartPlatform("netease")).toBe(true);
    expect(isChartPlatform("foo")).toBe(false);
    expect(normalizeBoard("douyin", "soar")).toBe("soar");
    expect(normalizeBoard("netease", "soar")).toBe("soar");
    expect(resolveSource("douyin", "soar")?.kind).toBe("ne");
    expect(resolveSource("netease", "soar")?.kind).toBe("ne");
    expect(resolveSource("qq", "soar")?.kind).toBe("qq");
    expect(resolveSource("network", "hot")?.kind).toBe("qq");
  });

  it("clears cache helper", () => {
    _clearChartCache();
    expect(true).toBe(true);
  });
});
