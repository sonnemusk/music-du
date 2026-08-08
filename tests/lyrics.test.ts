import { describe, expect, it, vi, afterEach } from "vitest";
import * as chksz from "../server/chksz.js";
import { resolveLyrics, _clearLyricServerCache } from "../server/lyrics.js";

afterEach(() => {
  chksz.setHttpTransport(null);
  _clearLyricServerCache();
  vi.unstubAllGlobals();
});

describe("resolveLyrics", () => {
  it("returns netease lyric when present", async () => {
    chksz.setHttpTransport(async (_m, url) => {
      if (String(url).includes("163_lyric")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: { lrc: "[00:01.00]hello world", tlyric: "[00:01.00]你好" },
          }),
        };
      }
      return { status: 404, json: async () => ({}) };
    });
    const d = await resolveLyrics(42, { apikey: "test_key" });
    expect(d.source).toBe("netease");
    expect(d.lrc).toContain("hello");
    expect(d.tlrc).toContain("你好");
  });

  it("falls back to search rematch when primary empty", async () => {
    let lyricCalls = 0;
    chksz.setHttpTransport(async (_m, url) => {
      const u = String(url);
      if (u.includes("163_lyric")) {
        lyricCalls++;
        // first id empty, second id has lyrics
        if (u.includes("id=1")) {
          return { status: 200, json: async () => ({ code: 200, data: { lrc: "" } }) };
        }
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: { lrc: "[00:02.00]rematched line that is long enough" },
          }),
        };
      }
      if (u.includes("163_search")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: [
              { id: 1, name: "Test Song", ar: [{ name: "Artist" }] },
              { id: 99, name: "Test Song", ar: [{ name: "Artist" }] },
            ],
          }),
        };
      }
      return { status: 404, json: async () => ({}) };
    });

    const d = await resolveLyrics(1, {
      apikey: "test_key",
      name: "Test Song",
      artist: "Artist",
    });
    expect(d.source).toBe("search");
    expect(d.matchedId).toBe("99");
    expect(d.lrc).toContain("rematched");
    expect(lyricCalls).toBeGreaterThanOrEqual(2);
  });

  it("falls back to lrclib when netease empty", async () => {
    chksz.setHttpTransport(async (_m, url) => {
      if (String(url).includes("163_lyric")) {
        return { status: 200, json: async () => ({ code: 200, data: { lrc: "" } }) };
      }
      if (String(url).includes("163_search")) {
        return { status: 200, json: async () => ({ code: 200, data: [] }) };
      }
      return { status: 404, json: async () => ({}) };
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const u = String(input);
        if (u.includes("lrclib.net")) {
          return {
            ok: true,
            json: async () => [
              {
                id: 7,
                trackName: "Sunny Day",
                artistName: "Someone",
                syncedLyrics: "[00:01.00]line from lrclib fallback source",
              },
            ],
          } as Response;
        }
        throw new Error("unexpected " + u);
      })
    );

    const d = await resolveLyrics(5, {
      apikey: "test_key",
      name: "Sunny Day",
      artist: "Someone",
    });
    expect(d.source).toBe("lrclib");
    expect(d.lrc).toContain("lrclib");
  });
});
