import { describe, expect, it } from "vitest";
import {
  formatSongId,
  isResolvedSongId,
  nativeSizeToLevel,
  parseSongId,
  qualityToNativeSize,
} from "../server/song-id.js";

describe("song-id", () => {
  it("parses netease / qq / kugou / ext", () => {
    expect(parseSongId(1901371647)).toEqual({ provider: "netease", nativeId: "1901371647" });
    expect(parseSongId("qq:0039MnYb0qxYhV")).toEqual({
      provider: "qq",
      nativeId: "0039MnYb0qxYhV",
    });
    expect(parseSongId("kg:48C685F679FFC7CF08B8A8341CA9DB44")).toEqual({
      provider: "kugou",
      nativeId: "48C685F679FFC7CF08B8A8341CA9DB44",
    });
    expect(parseSongId("ext:kw:1")).toEqual({ provider: "ext", nativeId: "kw:1" });
    expect(parseSongId("")).toBeNull();
  });

  it("marks native ids playable", () => {
    expect(isResolvedSongId("qq:0039MnYb0qxYhV")).toBe(true);
    expect(isResolvedSongId("kg:abc")).toBe(true);
    expect(isResolvedSongId("ext:qq:x")).toBe(false);
    expect(formatSongId("qq", "0039")).toBe("qq:0039");
  });

  it("maps quality names onto QQ/Kugou sizes", () => {
    expect(qualityToNativeSize("sky")).toBe("master");
    expect(qualityToNativeSize("lossless")).toBe("flac");
    expect(qualityToNativeSize("standard")).toBe("128k");
    expect(nativeSizeToLevel("master")).toBe("jymaster");
    expect(nativeSizeToLevel("320k")).toBe("exhigh");
  });
});
