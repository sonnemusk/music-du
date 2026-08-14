import { describe, expect, it } from "vitest";
import { isPrivateHostname, isSafeUpstreamUrl } from "../server/safe-url.js";

describe("isSafeUpstreamUrl", () => {
  it("allows public https CDNs", () => {
    expect(isSafeUpstreamUrl("https://m801.music.126.net/song.mp3")).toBe(true);
  });

  it("blocks localhost and link-local metadata", () => {
    expect(isPrivateHostname("localhost")).toBe(true);
    expect(isPrivateHostname("127.0.0.1")).toBe(true);
    expect(isPrivateHostname("169.254.169.254")).toBe(true);
    expect(isPrivateHostname("10.0.0.8")).toBe(true);
    expect(isSafeUpstreamUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isSafeUpstreamUrl("http://127.0.0.1:8787/api/health")).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isSafeUpstreamUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUpstreamUrl("javascript:alert(1)")).toBe(false);
  });
});
