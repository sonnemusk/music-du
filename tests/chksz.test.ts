import { afterEach, describe, expect, it } from "vitest";
import * as chksz from "../server/chksz.js";

afterEach(() => {
  chksz.setHttpTransport(null);
});

describe("chksz adapter", () => {
  it("normalize_song extracts id name artist cover https", () => {
    const n = chksz.normalizeSong({
      id: 1,
      name: "N",
      ar: [{ name: "A" }, { name: "B" }],
      al: { name: "AL", picUrl: "//p1.music.126.net/c.jpg" },
      dt: 1000,
    });
    expect(n.id).toBe(1);
    expect(n.name).toBe("N");
    expect(n.artist).toBe("A / B");
    expect(n.cover.startsWith("https://")).toBe(true);
    expect(n.album).toBe("AL");
  });

  it("search normalizes list and uses apikey only", async () => {
    let seenParams: any = null;
    chksz.setHttpTransport(async (_m, url, init) => {
      expect(url.includes("163_search") || (init?.params as any)).toBeTruthy();
      seenParams = init?.params;
      expect(seenParams.apikey).toBe("chksz_test_fixture_key");
      expect(seenParams.token).toBeUndefined();
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: [
            {
              id: 1901371647,
              name: "孤勇者",
              ar: [{ name: "陈奕迅" }],
              al: { name: "孤勇者", picUrl: "http://p3.music.126.net/x.jpg" },
              duration: 256000,
            },
          ],
        }),
      };
    });
    const songs = await chksz.search("孤勇者", 5, { apikey: "chksz_test_fixture_key" });
    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe(1901371647);
    expect(songs[0].name).toBe("孤勇者");
    expect(songs[0].artist).toContain("陈奕迅");
    expect(songs[0].cover.startsWith("https://")).toBe(true);
  });

  it("search requires apikey", async () => {
    await expect(chksz.search("x", 5, { apikey: "" })).rejects.toMatchObject({
      status: 401,
    });
  });

  it("fetch_music quality ladder prefers first working https url", async () => {
    const calls: string[] = [];
    chksz.setHttpTransport(async (_m, _url, init) => {
      const lv = String(init?.params?.level || "");
      calls.push(lv);
      if (lv === "jymaster") {
        return { status: 200, json: async () => ({ code: 200, data: { url: "" } }) };
      }
      if (lv === "sky") {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: {
              id: 1,
              url: "http://m7.music.126.net/sky.flac",
              br: 900000,
              level: "sky",
            },
          }),
        };
      }
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: { url: "http://m7.music.126.net/other.mp3" },
        }),
      };
    });
    const raw = await chksz.fetchMusic(1, null, { apikey: "chksz_test_fixture_key" });
    expect(raw.url.startsWith("https://")).toBe(true);
    expect(raw.url).toContain("sky.flac");
    expect(raw._requested_level).toBe("sky");
    expect(calls[0]).toBe("jymaster");
    expect(calls).toContain("sky");
    expect(calls).not.toContain("standard");
  });

  it("probeTopQualities keeps first 3 that have urls", async () => {
    chksz.setHttpTransport(async (_m, _url, init) => {
      const lv = String(init?.params?.level || "");
      // no jymaster/sky
      if (lv === "jymaster" || lv === "sky") {
        return { status: 200, json: async () => ({ code: 200, data: { url: "" } }) };
      }
      if (lv === "jyeffect" || lv === "hires" || lv === "exhigh") {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: {
              url: `http://m7.music.126.net/${lv}.flac`,
              br: 320000,
              level: lv,
            },
          }),
        };
      }
      return { status: 200, json: async () => ({ code: 200, data: { url: "" } }) };
    });
    const top = await chksz.probeTopQualities(9, 3, {
      apikey: "chksz_test_fixture_key",
    });
    expect(top.map((x) => x.level)).toEqual(["jyeffect", "hires", "exhigh"]);
    expect(top[0].url).toContain("jyeffect");
  });

  it("fetch_lyric returns lrc fields", async () => {
    chksz.setHttpTransport(async () => ({
      status: 200,
      json: async () => ({
        code: 200,
        data: { lrc: "[00:01.00]hello", tlyric: "[00:01.00]hi" },
      }),
    }));
    const d = await chksz.fetchLyric(1, { apikey: "chksz_test_fixture_key" });
    expect(d.lrc).toContain("hello");
    expect(d.tlrc).toContain("hi");
  });
});
