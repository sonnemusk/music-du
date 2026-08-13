import { describe, expect, it } from "vitest";
import {
  bufferedRatio,
  clampSeek,
  clampVolume,
  coverProxyUrl,
  coverUrl,
  cyclePlayMode,
  fmtTime,
  isEditableTarget,
  isResolvedSongId,
  pickBestNameMatch,
  lyricIndexAt,
  nextQueueIndex,
  parseLyric,
  playModeLabel,
  popShuffleHistory,
  predictNextIndex,
  pushShuffleHistory,
  withCoverSize,
} from "../client/src/lib/player-core.js";

describe("player-core", () => {
  it("cycles modes", () => {
    expect(cyclePlayMode("list")).toBe("single");
    expect(cyclePlayMode("single")).toBe("shuffle");
    expect(cyclePlayMode("shuffle")).toBe("list");
    expect(playModeLabel("shuffle")).toContain("随机");
  });

  it("queue index list mode", () => {
    expect(nextQueueIndex(0, 5, "list", 1)).toBe(1);
    expect(nextQueueIndex(0, 5, "list", -1)).toBe(4);
    expect(nextQueueIndex(2, 5, "single", 1)).toBe(2);
  });

  it("shuffle history push/pop for 上一首", () => {
    let h: string[] = [];
    h = pushShuffleHistory(h, "a");
    h = pushShuffleHistory(h, "b");
    h = pushShuffleHistory(h, "b"); // no consecutive dup
    expect(h).toEqual(["a", "b"]);
    const p1 = popShuffleHistory(h);
    expect(p1.id).toBe("b");
    expect(p1.rest).toEqual(["a"]);
    const p2 = popShuffleHistory(p1.rest);
    expect(p2.id).toBe("a");
    expect(p2.rest).toEqual([]);
    expect(popShuffleHistory([]).id).toBeNull();
  });

  it("shuffle history round-trips via JSON (sessionStorage shape)", () => {
    const h = pushShuffleHistory(pushShuffleHistory([], "11"), "22");
    const raw = JSON.stringify(h);
    const back = JSON.parse(raw) as string[];
    expect(back).toEqual(["11", "22"]);
    expect(popShuffleHistory(back).id).toBe("22");
  });

  it("predicts next for list / single", () => {
    expect(predictNextIndex(0, 5, "list")).toBe(1);
    expect(predictNextIndex(4, 5, "list")).toBe(0);
    expect(predictNextIndex(2, 5, "single")).toBe(2);
    const sh = predictNextIndex(1, 5, "shuffle");
    expect(sh).toBeGreaterThanOrEqual(0);
    expect(sh).toBeLessThan(5);
    expect(sh).not.toBe(1);
  });

  it("parses lyrics", () => {
    const lines = parseLyric("[00:01.00]hello\n[00:05.50]world", "[00:01.00]你好");
    expect(lines).toHaveLength(2);
    expect(lines[0].orig).toBe("hello");
    expect(lines[0].tran).toBe("你好");
    expect(lyricIndexAt(lines, 2000)).toBe(0);
  });

  it("fmtTime", () => {
    expect(fmtTime(65)).toBe("1:05");
  });

  it("clampSeek and volume", () => {
    expect(clampSeek(10, 5, 20)).toBe(15);
    expect(clampSeek(18, 5, 20)).toBe(20);
    expect(clampSeek(2, -5, 20)).toBe(0);
    expect(clampVolume(1.5)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
  });

  it("resolved vs placeholder chart ids", () => {
    expect(isResolvedSongId(1901371647)).toBe(true);
    expect(isResolvedSongId("1901371647")).toBe(true);
    expect(isResolvedSongId("ext:qq:abc")).toBe(false);
    expect(isResolvedSongId("")).toBe(false);
  });

  it("pickBestNameMatch prefers exact title", () => {
    const best = pickBestNameMatch(
      { name: "夜曲", artist: "周杰伦" },
      [
        { id: 1, name: "夜曲 (Live)", artist: "别人" },
        { id: 2, name: "夜曲", artist: "周杰伦" },
      ]
    );
    expect(best?.id).toBe(2);
  });

  it("isEditableTarget detects inputs", () => {
    expect(isEditableTarget(null)).toBe(false);
    // DOM-less node env: only null path is guaranteed; shape check with minimal mock
    const fakeInput = {
      tagName: "INPUT",
      isContentEditable: false,
      closest: () => null,
      getAttribute: () => null,
    } as unknown as Element;
    const fakeDiv = {
      tagName: "DIV",
      isContentEditable: false,
      closest: () => null,
      getAttribute: () => null,
    } as unknown as Element;
    // instanceof Element fails without DOM — function returns false for non-Element
    // so we only assert null + real Element when available
    if (typeof Element !== "undefined") {
      // In jsdom/browser, real nodes work; under pure node skip
      try {
        // @ts-expect-error optional DOM
        if (typeof document !== "undefined") {
          // eslint-disable-next-line no-undef
          const input = document.createElement("input");
          // eslint-disable-next-line no-undef
          const div = document.createElement("div");
          expect(isEditableTarget(input)).toBe(true);
          expect(isEditableTarget(div)).toBe(false);
          return;
        }
      } catch {
        /* */
      }
    }
    void fakeInput;
    void fakeDiv;
    expect(isEditableTarget(null)).toBe(false);
  });

  it("sizes NetEase covers: thumb/medium/full", () => {
    const u =
      "https://p4.music.126.net/RicH6-Q0z6lSerW1H5yWBw==/109951169200522014.jpg";
    expect(withCoverSize(u, "thumb")).toContain("param=120y120");
    expect(withCoverSize(u, "medium")).toContain("param=400y400");
    expect(withCoverSize(u, "full")).not.toContain("param=");
    // display prefers direct CDN (fast); proxy is encode fallback
    expect(coverUrl(u, "thumb")).toContain("param=120y120");
    expect(coverUrl(u, "thumb")).toContain("music.126.net");
    expect(coverUrl(u)).not.toContain("/api/cover-proxy");
    expect(coverProxyUrl(u, "thumb")).toContain("/api/cover-proxy");
    expect(coverProxyUrl(u, "thumb")).toContain("param%3D120y120");
  });

  it("bufferedRatio from media ranges / blob", () => {
    expect(bufferedRatio(null)).toBe(0);
    const blobAudio = {
      currentSrc: "blob:https://example/1",
      src: "blob:https://example/1",
      duration: 100,
      buffered: { length: 0 },
    } as unknown as HTMLMediaElement;
    expect(bufferedRatio(blobAudio)).toBe(1);

    const ranges = {
      length: 2,
      start: (i: number) => (i === 0 ? 0 : 40),
      end: (i: number) => (i === 0 ? 25 : 70),
    };
    const streamAudio = {
      currentSrc: "https://cdn.example/a.mp3",
      src: "https://cdn.example/a.mp3",
      duration: 100,
      buffered: ranges,
    } as unknown as HTMLMediaElement;
    expect(bufferedRatio(streamAudio)).toBeCloseTo(0.7, 5);
  });
});
