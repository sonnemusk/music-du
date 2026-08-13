import { describe, expect, it } from "vitest";
import { sniffImageContentType } from "../server/cover-cache.js";

describe("cover cache sniff", () => {
  it("reads PNG magic even if someone stored it as .jpg", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffImageContentType(png)).toBe("image/png");
  });

  it("reads JPEG / GIF / WEBP magics", () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0]);
    const webp = Buffer.from("RIFF....WEBP", "ascii");
    expect(sniffImageContentType(jpg)).toBe("image/jpeg");
    expect(sniffImageContentType(gif)).toBe("image/gif");
    expect(sniffImageContentType(webp)).toBe("image/webp");
  });
});
