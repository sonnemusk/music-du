import { describe, expect, it } from "vitest";
import {
  chartEdgeMaxAgeSec,
  isChartBoard,
  isChartPlatform,
  listChartBoards,
  listChartPlatforms,
  normalizeBoard,
  planChartRematch,
  resolveSource,
  CHART_REMATCH_BUDGET,
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

  it("caps rematch budget so QQ-style rows cannot fire 40 searches", () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      name: `t${i}`,
      artist: "a",
    }));
    const { ready, toSearch } = planChartRematch(rows);
    expect(ready).toHaveLength(0);
    expect(toSearch).toHaveLength(CHART_REMATCH_BUDGET);
    expect(CHART_REMATCH_BUDGET).toBeLessThanOrEqual(8);
  });

  it("netease ids skip rematch and do not consume the budget", () => {
    const rows = [
      { name: "a", artist: "x", neteaseId: 1 },
      { name: "b", artist: "y", neteaseId: 2 },
      ...Array.from({ length: 20 }, (_, i) => ({ name: `q${i}`, artist: "z" })),
    ];
    const { ready, toSearch } = planChartRematch(rows);
    expect(ready).toHaveLength(2);
    expect(toSearch).toHaveLength(CHART_REMATCH_BUDGET);
  });

  it("edge TTL is 2h for soar, not 12h", () => {
    expect(chartEdgeMaxAgeSec("soar")).toBe(2 * 3600);
    expect(chartEdgeMaxAgeSec("new")).toBe(3 * 3600);
    expect(chartEdgeMaxAgeSec("hot")).toBe(8 * 3600);
  });
});
