import { describe, expect, it } from "vitest";
import {
  countNewFavorites,
  filterNewById,
  isFavsExportShape,
  minScoreForMatch,
  parseFavsExportJson,
  parseImportPayload,
  parseNameArtistLine,
  scoreNameMatch,
} from "../server/favs-import.js";

describe("exact /favs export", () => {
  it("accepts export shape and dedupes ids", () => {
    const raw = {
      exportedAt: "2026-08-08T00:00:00.000Z",
      source: "music.dubin.cc",
      count: 2,
      favorites: [
        { id: 1, name: "A", artist: "X", album: "", cover: "", duration: 1 },
        { id: 1, name: "dup", artist: "X", album: "", cover: "", duration: 1 },
        { id: 2, name: "B", artist: "Y", album: "", cover: "", duration: 2 },
      ],
    };
    expect(isFavsExportShape(raw)).toBe(true);
    const p = parseFavsExportJson(raw);
    expect(p.ok && p.tracks.map((t) => t.id)).toEqual([1, 2]);
    const payload = parseImportPayload(JSON.stringify(raw));
    expect(payload.ok && payload.mode).toBe("exact");
  });
});

describe("name / name+artist lines", () => {
  it("parses name only and name - artist", () => {
    expect(parseNameArtistLine("孤勇者")).toEqual({ name: "孤勇者", artist: "" });
    expect(parseNameArtistLine("孤勇者 - 陈奕迅")).toEqual({
      name: "孤勇者",
      artist: "陈奕迅",
    });
    expect(parseNameArtistLine("晴天\t周杰伦")).toEqual({
      name: "晴天",
      artist: "周杰伦",
    });
    expect(parseNameArtistLine("稻香,周杰伦")).toEqual({
      name: "稻香",
      artist: "周杰伦",
    });
    expect(parseNameArtistLine("# comment")).toBeNull();
  });

  it("parseImportPayload text mode", () => {
    const text = "孤勇者 - 陈奕迅\n晴天\n孤勇者 - 陈奕迅\n";
    const p = parseImportPayload(text);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.mode).toBe("name");
      expect(p.rows).toHaveLength(2);
    }
  });

  it("parseImportPayload name json array", () => {
    const p = parseImportPayload(
      JSON.stringify([
        { name: "孤勇者", artist: "陈奕迅" },
        { name: "晴天" },
        { id: 99, name: "有id", artist: "X" },
      ])
    );
    expect(p.ok && p.mode).toBe("mixed");
    if (p.ok) {
      expect(p.rows.filter((r) => r.kind === "exact")).toHaveLength(1);
      expect(p.rows.filter((r) => r.kind === "name")).toHaveLength(2);
    }
  });
});

describe("match scoring", () => {
  it("prefers exact name+artist", () => {
    const good = scoreNameMatch("孤勇者", "陈奕迅", "孤勇者", "陈奕迅");
    const bad = scoreNameMatch("孤勇者", "陈奕迅", "孤勇者 (伴奏)", "DJ某某");
    expect(good).toBeGreaterThanOrEqual(minScoreForMatch(true));
    expect(good).toBeGreaterThan(bad);
  });

  it("name-only needs higher score", () => {
    expect(minScoreForMatch(false)).toBeGreaterThan(minScoreForMatch(true));
    expect(scoreNameMatch("晴天", "", "晴天", "周杰伦")).toBeGreaterThanOrEqual(
      minScoreForMatch(false)
    );
  });
});

describe("dedupe against existing", () => {
  it("countNewFavorites and filterNewById", () => {
    expect(
      countNewFavorites([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }, { id: 3 }])
    ).toBe(1);
    expect(
      filterNewById([{ id: 1 }], [
        { id: 1, name: "a" },
        { id: 2, name: "b" },
      ])
    ).toEqual([{ id: 2, name: "b" }]);
  });
});
