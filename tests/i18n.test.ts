import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocaleModule, t } from "../client/src/i18n/index.js";
import { playModeLabel } from "../client/src/lib/player-core.js";
import { labelForLevel } from "../client/src/lib/quality.js";

describe("i18n", () => {
  afterEach(() => {
    setLocaleModule("zh");
  });

  it("defaults to Chinese", () => {
    setLocaleModule("zh");
    expect(getLocale()).toBe("zh");
    expect(t("tabs.favorites")).toBe("喜欢");
    expect(playModeLabel("shuffle")).toContain("随机");
  });

  it("switches to English", () => {
    setLocaleModule("en");
    expect(t("tabs.favorites")).toBe("Liked");
    expect(t("transport.next")).toBe("Next");
    expect(playModeLabel("shuffle", "en")).toBe("Shuffle");
    expect(labelForLevel("jymaster", "en").short).toMatch(/Master/i);
  });

  it("interpolates vars", () => {
    setLocaleModule("en");
    expect(t("toast.imported", { n: 3, total: 10 })).toContain("3");
    expect(t("toast.imported", { n: 3, total: 10 })).toContain("10");
  });
});
