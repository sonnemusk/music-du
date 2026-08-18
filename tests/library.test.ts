import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SqliteLibrary } from "../server/library.js";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* */
    }
  }
  tmpDirs.length = 0;
});

function tmpDb() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kazam-lib-"));
  tmpDirs.push(d);
  return path.join(d, "library.db");
}

function track(i: number) {
  return {
    id: 1000 + i,
    name: `Song ${i}`,
    artist: `Artist ${i}`,
    album: "A",
    cover: "",
    duration: 180,
  };
}

describe("SqliteLibrary", () => {
  it("add → load → delete → load sticks for playlist", () => {
    const lib = new SqliteLibrary(tmpDb());
    lib.save({
      playlist: [track(1), track(2), track(3)],
      favorites: [],
      history: [],
      curIdx: 0,
    });
    expect(lib.load().playlist).toHaveLength(3);
    lib.deleteSid("playlist", 1002);
    const again = lib.load();
    expect(again.playlist.map((t) => String(t.id))).not.toContain("1002");
    expect(again.playlist).toHaveLength(2);
  });

  it("history delete persists", () => {
    const lib = new SqliteLibrary(tmpDb());
    lib.save({
      playlist: [],
      favorites: [],
      history: [track(1), track(2), track(3)],
      curIdx: -1,
    });
    lib.deleteSid("history", 1002);
    const ids = lib.load().history.map((t) => String(t.id));
    expect(ids).not.toContain("1002");
    expect(ids).toHaveLength(2);
  });

  it("empty playlist without force does not wipe", () => {
    const lib = new SqliteLibrary(tmpDb());
    lib.save({
      playlist: [track(1), track(2)],
      favorites: [track(9)],
      history: [],
      curIdx: 0,
    });
    lib.mergePut(
      { playlist: [], favorites: [track(9)], history: [], curIdx: -1 },
      { forceClearPlaylist: false }
    );
    expect(lib.load().playlist).toHaveLength(2);
    lib.mergePut(
      { playlist: [], favorites: [track(9)], history: [], curIdx: -1 },
      { forceClearPlaylist: true }
    );
    expect(lib.load().playlist).toHaveLength(0);
    expect(lib.load().favorites).toHaveLength(1);
  });

  it("bumps revision and rejects a stale PUT", () => {
    const lib = new SqliteLibrary(tmpDb());
    const first = lib.save({
      playlist: [track(1)],
      favorites: [],
      history: [],
      curIdx: 0,
    });
    expect(first.revision).toBeGreaterThanOrEqual(1);
    const second = lib.mergePut({
      playlist: [track(1), track(2)],
      favorites: [],
      history: [],
      curIdx: 0,
      revision: first.revision,
    });
    expect(second.revision).toBe((first.revision || 0) + 1);
    expect(() =>
      lib.save({
        playlist: [track(9)],
        favorites: [],
        history: [],
        curIdx: 0,
        revision: first.revision,
      })
    ).toThrow(/revision conflict/);
    expect(lib.load().playlist).toHaveLength(2);
  });

  it("deleteSid rejects a stale revision and leaves the row", () => {
    const lib = new SqliteLibrary(tmpDb());
    const first = lib.save({
      playlist: [track(1), track(2)],
      favorites: [],
      history: [],
      curIdx: 0,
    });
    const second = lib.mergePut({
      playlist: [track(1), track(2), track(3)],
      favorites: [],
      history: [],
      curIdx: 0,
      revision: first.revision,
    });
    expect(() => lib.deleteSid("playlist", 1002, first.revision)).toThrow(/revision conflict/);
    expect(lib.load().playlist).toHaveLength(3);
    const after = lib.deleteSid("playlist", 1002, second.revision);
    expect(after.playlist.map((t) => String(t.id))).not.toContain("1002");
    expect(after.revision).toBe((second.revision || 0) + 1);
  });

  it("deleteSid without a revision still deletes (legacy clients)", () => {
    const lib = new SqliteLibrary(tmpDb());
    lib.save({
      playlist: [track(1), track(2)],
      favorites: [],
      history: [],
      curIdx: 0,
    });
    const after = lib.deleteSid("playlist", 1001);
    expect(after.playlist.map((t) => String(t.id))).not.toContain("1001");
  });
});
