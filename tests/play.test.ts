import { afterEach, describe, expect, it } from "vitest";
import * as chksz from "../server/chksz.js";
import { chooseAudioSrc, onRemoteError, resolvePlay } from "../server/play.js";

afterEach(() => chksz.setHttpTransport(null));

describe("play path", () => {
  it("prefers remote https url", () => {
    const got = chooseAudioSrc(
      { url: "https://m7.music.126.net/x.flac" },
      "/api/stream/42"
    );
    expect(got.mode).toBe("remote");
    expect(got.src.startsWith("https://")).toBe(true);
    expect(got.fallback).toBe("/api/stream/42");
  });

  it("uses stream when no url", () => {
    const got = chooseAudioSrc({ url: "" }, "/api/stream/42");
    expect(got.mode).toBe("stream");
    expect(got.src).toBe("/api/stream/42");
  });

  it("onRemoteError falls back to stream", () => {
    expect(onRemoteError("/api/stream/99")).toEqual({
      src: "/api/stream/99",
      mode: "stream",
      fallback: null,
    });
  });

  it("resolvePlay remote via transport without apikey on free primary", async () => {
    chksz.setHttpTransport(async (_m, _u, init) => {
      expect(init?.params?.apikey).toBeUndefined();
      return {
        status: 200,
        json: async () => ({
          code: 200,
          data: {
            id: 1,
            url: "http://m7.music.126.net/demo.flac",
            br: 999000,
            name: "Demo",
            artist: "X",
          },
        }),
      };
    });
    const src = await resolvePlay(1, null);
    expect(src.source).toBe("remote");
    expect(src.url.startsWith("https://")).toBe(true);
  });

  it("resolvePlay stream when empty url", async () => {
    chksz.setHttpTransport(async () => ({
      status: 200,
      json: async () => ({ code: 200, data: { url: "" } }),
    }));
    const src = await resolvePlay(2, null);
    expect(["stream", "none"]).toContain(src.source);
    expect(src.url.startsWith("/api/stream/")).toBe(true);
  });
});
