import { afterEach, describe, expect, it } from "vitest";
import * as chksz from "../server/chksz.js";
import { chkszHostNeedsKey, chkszPrimaryBase } from "../server/config.js";

afterEach(() => {
  chksz.setHttpTransport(null);
  chksz.resetKeyRotationForTests();
  delete process.env.CHKSZ_FALLBACK_APIKEYS;
  delete process.env.CHKSZ_APIKEY;
  delete process.env.CHKSZ_TOKEN;
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

  it("interprets HTML 403 served as HTTP 200 as retryable 403", () => {
    const html = "<html><head><title>403 Forbidden</title></head></html>";
    const got = chksz.interpretUpstreamHttp(200, html, "text/html");
    expect(got.status).toBe(403);
    expect(got.body.error).toBe("forbidden");
  });

  it("treats HTML 404 as retryable 502 so fallback can run", () => {
    const html = "<html><head><title>404 Not Found</title></head></html>";
    const got = chksz.interpretUpstreamHttp(404, html, "text/html");
    expect(got.status).toBe(502);
  });

  it("keeps real JSON 200", () => {
    const got = chksz.interpretUpstreamHttp(
      200,
      JSON.stringify({ code: 200, data: [] }),
      "application/json"
    );
    expect(got.status).toBe(200);
    expect(got.body.code).toBe(200);
  });

  it("defaults to the keyed .com gateway", () => {
    const prev = process.env.CHKSZ_API_BASE;
    delete process.env.CHKSZ_API_BASE;
    try {
      expect(chkszPrimaryBase()).toBe("https://api.chksz.com");
      expect(chkszHostNeedsKey("https://api.chksz.com")).toBe(true);
      expect(chkszHostNeedsKey("https://api.chksz.top")).toBe(false);
    } finally {
      if (prev !== undefined) process.env.CHKSZ_API_BASE = prev;
      else delete process.env.CHKSZ_API_BASE;
    }
  });

  it("forwards CHKSZ_APIKEY on search", async () => {
    process.env.CHKSZ_APIKEY = "test-key";
    let seen: Record<string, string | number> | undefined;
    chksz.setHttpTransport(async (_m, _url, init) => {
      seen = init?.params;
      return { status: 200, json: async () => ({ code: 200, data: [] }) };
    });
    await chksz.search("x", 1);
    expect(seen?.apikey).toBe("test-key");
  });

  it("search without configured key omits apikey (transport)", async () => {
    let seenParams: any = null;
    let seenUrl = "";
    chksz.setHttpTransport(async (_m, url, init) => {
      seenUrl = url;
      seenParams = init?.params;
      expect(seenParams?.apikey).toBeUndefined();
      expect(String(url)).not.toMatch(/apikey=/);
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
    const songs = await chksz.search("孤勇者", 5);
    expect(songs).toHaveLength(1);
    expect(songs[0].id).toBe(1901371647);
    expect(songs[0].name).toBe("孤勇者");
    expect(songs[0].artist).toContain("陈奕迅");
    expect(songs[0].cover.startsWith("https://")).toBe(true);
    expect(seenUrl).toContain("163_search");
  });

  it("fetch_music quality ladder prefers first working https url", async () => {
    const calls: string[] = [];
    chksz.setHttpTransport(async (_m, _url, init) => {
      const lv = String(init?.params?.level || "");
      calls.push(lv);
      expect(init?.params?.apikey).toBeUndefined();
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
    const raw = await chksz.fetchMusic(1, null);
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
    const top = await chksz.probeTopQualities(9, 3);
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
    const d = await chksz.fetchLyric(1);
    expect(d.lrc).toContain("hello");
    expect(d.tlrc).toContain("hi");
  });

  it("searchAll merges NetEase then unique QQ / Kugou", async () => {
    chksz.setHttpTransport(async (_m, url) => {
      const u = String(url);
      if (u.includes("163_search")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: [{ id: 1, name: "晴天", ar: [{ name: "周杰伦" }], al: { name: "叶惠美" } }],
          }),
        };
      }
      if (u.includes("qq_music")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            count: 2,
            list: [
              { n: 1, name: "晴天", singer: "周杰伦", mid: "0039MnYb0qxYhV" },
              { n: 2, name: "七里香", singer: "周杰伦", mid: "qqmid2" },
            ],
          }),
        };
      }
      if (u.includes("kugou_music")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            list: [{ n: 1, id: "KG1", name: "东风破", singer: "周杰伦" }],
          }),
        };
      }
      return { status: 404, json: async () => ({}) };
    });
    const rows = await chksz.searchAll("周杰伦", 10);
    expect(rows.map((r) => r.name)).toEqual(["晴天", "七里香", "东风破"]);
    expect(rows[0]!.id).toBe(1);
    expect(rows[1]!.id).toBe("qq:qqmid2");
    expect(rows[2]!.id).toBe("kg:KG1");
  });

  it("reads a QQ play url nested in data[] and a string code", async () => {
    chksz.setHttpTransport(async () => ({
      status: 200,
      json: async () => ({
        code: "200",
        data: [{ url: "http://cdn.example/a.mp3", name: "晴天", singer: "周杰伦" }],
      }),
    }));
    const raw = await chksz.fetchMusic("qq:0039MnYb0qxYhV", "flac");
    expect(raw.url).toBe("https://cdn.example/a.mp3");
    expect(raw.artist).toBe("周杰伦");
  });

  it("falls back to NetEase when a chart mid has no playable url", async () => {
    const calls: string[] = [];
    chksz.setHttpTransport(async (_m, url) => {
      const u = String(url);
      calls.push(u);
      if (u.includes("qq_music") || u.includes("kugou_music")) {
        return { status: 200, json: async () => ({ code: 200, msg: "empty" }) };
      }
      if (u.includes("163_search")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: [{ id: 1901371647, name: "晴天", ar: [{ name: "周杰伦" }] }],
          }),
        };
      }
      if (u.includes("163_music")) {
        return {
          status: 200,
          json: async () => ({
            code: 200,
            data: {
              url: "https://m7.music.126.net/qingtian.mp3",
              name: "晴天",
              artist: "周杰伦",
              level: "standard",
            },
          }),
        };
      }
      return { status: 404, json: async () => ({}) };
    });
    const qq = await chksz.fetchMusic("qq:0039MnYb0qxYhV", "standard", {
      name: "晴天",
      artist: "周杰伦",
    });
    expect(qq.url).toContain("qingtian.mp3");
    expect(calls.some((u) => u.includes("163_search"))).toBe(true);

    calls.length = 0;
    const kg = await chksz.fetchMusic("kg:6A350E487263733359E7F2B64BD974AC", "standard", {
      name: "晴天",
      artist: "周杰伦",
    });
    expect(kg.url).toContain("qingtian.mp3");
    const ext = await chksz.fetchMusic("ext:kw:7201115", "standard", {
      name: "我好像在哪见过你",
      artist: "薛之谦",
    });
    expect(ext.url || "").not.toContain("qingtian");
  });

  it("does not search NetEase when no title hint is present", async () => {
    const calls: string[] = [];
    chksz.setHttpTransport(async (_m, url) => {
      calls.push(String(url));
      return { status: 200, json: async () => ({ code: 200 }) };
    });
    const raw = await chksz.fetchMusic("qq:0039MnYb0qxYhV", "standard");
    expect(raw.url).toBeUndefined();
    expect(calls.some((u) => u.includes("163_search"))).toBe(false);
  });

  it("rejects a weak title when picking a NetEase fallback", () => {
    const hit = {
      id: 1,
      name: "晴天娃娃",
      artist: "别人",
      album: "",
      cover: "",
      duration: 0,
    };
    expect(chksz.pickNeteaseFallback("晴天", "周杰伦", [hit])).toBeNull();
    expect(
      chksz.pickNeteaseFallback("晴天", "周杰伦", [
        { ...hit, id: 9, name: "晴天", artist: "周杰伦" },
      ])?.id
    ).toBe(9);
  });

  it("fetchMusic routes qq: ids to qq_music", async () => {
    let seen = "";
    chksz.setHttpTransport(async (_m, url) => {
      seen = String(url);
      return {
        status: 200,
        json: async () => ({
          code: 200,
          url: "https://dl.example/a.flac",
          name: "晴天",
          singer: "周杰伦",
          bitrate: "flac",
        }),
      };
    });
    const raw = await chksz.fetchMusic("qq:0039MnYb0qxYhV", "sky");
    expect(seen).toContain("qq_music");
    expect(seen).toContain("mid=0039MnYb0qxYhV");
    expect(raw.url).toContain("https://");
    expect(raw.level).toBe("jymaster");
    expect(raw.artist).toBe("周杰伦");
  });

  it("primary free failure surfaces when transport is single-host", async () => {
    chksz.setHttpTransport(async () => ({
      status: 429,
      json: async () => ({ msg: "rate limited" }),
    }));
    await expect(chksz.search("x", 1)).rejects.toMatchObject({ status: 429 });
  });
});
