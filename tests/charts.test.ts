import fs from "node:fs";
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
  kuwoTrackDuration,
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

  it("QQ mid and Kugou hash rows are playable without rematch", () => {
    const qq = chartTrackFromRaw(
      { name: "晴天", artist: "周杰伦", sourceKey: "qq:0039MnYb0qxYhV" },
      1
    );
    const kg = chartTrackFromRaw(
      { name: "晴天", artist: "周杰伦", sourceKey: "kg:48C685F679FFC7CF08B8A8341CA9DB44" },
      2
    );
    const kw = chartTrackFromRaw(
      { name: "晴天", artist: "周杰伦", sourceKey: "kw:12345" },
      3
    );
    expect(qq?.id).toBe("qq:0039MnYb0qxYhV");
    expect(isResolvedSongId(qq?.id)).toBe(true);
    expect(kg?.id).toBe("kg:48C685F679FFC7CF08B8A8341CA9DB44");
    expect(isResolvedSongId(kg?.id)).toBe(true);
    expect(String(kw?.id).startsWith("ext:")).toBe(true);
    expect(isResolvedSongId(kw?.id)).toBe(false);
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

  it("kuwo bang duration uses song_duration seconds, not minutes*1000", () => {
    expect(kuwoTrackDuration({ song_duration: "275", duration: "4" })).toBe(275);
    expect(kuwoTrackDuration({ duration: "4" })).toBe(240);
    expect(kuwoTrackDuration({ duration: "03:15" })).toBe(195);
    expect(kuwoTrackDuration({ duration: 275 })).toBe(275);
  });
});

describe("client loadCharts generation token", () => {
  it("drops stale board responses the way search drops stale queries", () => {
    const src = fs.readFileSync(
      new URL("../client/src/store/player.ts", import.meta.url),
      "utf8"
    );
    expect(src).toMatch(/let chartGen = 0/);
    expect(src).toMatch(/const gen = \+\+chartGen/);
    expect(src).toMatch(/if \(gen !== chartGen\) return/);
    expect(src).toMatch(/await api\.fetchChart[\s\S]*if \(gen !== chartGen\) return/s);
  });
});
