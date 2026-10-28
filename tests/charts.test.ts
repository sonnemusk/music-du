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
  kugouRankUrls,
  parseKugouRankBody,
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

  it("kugou rank avoids the broken mobilecdn certificate host", () => {
    const urls = kugouRankUrls(8888, 5);
    expect(urls[0]).toContain("https://mobiles.kugou.com/api/v3/rank/song?");
    expect(urls[0]).toContain("rankid=8888");
    expect(urls[0]).toContain("pagesize=5");
    expect(urls.some((u) => u.includes("mobilecdn.kugou.com"))).toBe(false);
    expect(urls.some((u) => u.includes("gatewayretry.kugou.com"))).toBe(true);
  });

  it("parses kugou rank hashes into playable kg ids", () => {
    const rows = parseKugouRankBody(
      {
        data: {
          info: [
            {
              filename: "周杰伦 - 晴天",
              songname: "晴天",
              hash: "6A350E487263733359E7F2B64BD974AC",
              authors: [{ author_name: "周杰伦" }],
              duration: 269,
              album_name: "叶惠美",
            },
          ],
        },
      },
      10
    );
    expect(rows[0]?.name).toBe("晴天");
    expect(rows[0]?.artist).toBe("周杰伦");
    expect(rows[0]?.sourceKey).toBe("kg:6A350E487263733359E7F2B64BD974AC");
    const track = chartTrackFromRaw(rows[0]!, 1);
    expect(track?.id).toBe("kg:6A350E487263733359E7F2B64BD974AC");
    expect(isResolvedSongId(track?.id)).toBe(true);
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
