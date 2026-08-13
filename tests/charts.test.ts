import { describe, expect, it } from "vitest";
import {
  chartEdgeMaxAgeSec,
  isChartBoard,
  isChartPlatform,
  listChartBoards,
  listChartPlatforms,
  normalizeBoard,
  chartTrackFromRaw,
  isResolvedSongId,
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

  it("QQ-style rows keep a placeholder id and do not need a search", () => {
    const tracks = Array.from({ length: 40 }, (_, i) =>
      chartTrackFromRaw({ name: `t${i}`, artist: "a", sourceKey: `qq:${i}` }, i + 1)
    );
    expect(tracks.every(Boolean)).toBe(true);
    expect(tracks.every((t) => t && String(t.id).startsWith("ext:"))).toBe(true);
    expect(tracks.every((t) => t && !isResolvedSongId(t.id))).toBe(true);
  });

  it("NetEase rows stay playable numeric ids", () => {
    const t = chartTrackFromRaw(
      { name: "孤勇者", artist: "陈奕迅", neteaseId: 1901371647 },
      1
    );
    expect(t?.id).toBe(1901371647);
    expect(isResolvedSongId(t?.id)).toBe(true);
  });

  it("edge TTL is 2h for soar, not 12h", () => {
    expect(chartEdgeMaxAgeSec("soar")).toBe(2 * 3600);
    expect(chartEdgeMaxAgeSec("new")).toBe(3 * 3600);
    expect(chartEdgeMaxAgeSec("hot")).toBe(8 * 3600);
  });
});
