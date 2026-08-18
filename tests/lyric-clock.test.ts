import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getLyricIdx, setLyricIdx } from "../client/src/store/lyric-clock.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("lyric-clock", () => {
  it("stores the active line outside the player store", () => {
    setLyricIdx(-1);
    expect(getLyricIdx()).toBe(-1);
    setLyricIdx(3);
    expect(getLyricIdx()).toBe(3);
    setLyricIdx(3);
    expect(getLyricIdx()).toBe(3);
    setLyricIdx(Number.NaN);
    expect(getLyricIdx()).toBe(-1);
  });

  it("keeps tick and lyrics views off player.lyricIdx", () => {
    const player = fs.readFileSync(path.join(root, "client/src/store/player.ts"), "utf8");
    const view = fs.readFileSync(
      path.join(root, "client/src/components/LyricsView.tsx"),
      "utf8"
    );
    expect(player).toMatch(/setLyricIdx\(/);
    expect(player).not.toMatch(/lyricIdx/);
    expect(view).toMatch(/useLyricIdx/);
    expect(view).not.toMatch(/s\.lyricIdx/);
  });
});
