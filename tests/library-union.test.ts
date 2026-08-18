import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  resolveStructuralLibraryConflict,
  trackIdSetEqual,
  unionTracksById,
} from "../client/src/lib/library-union.js";
import type { Track } from "../client/src/lib/types.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function t(id: number, name = `s${id}`): Track {
  return { id, name, artist: "A", album: "", cover: "", duration: 1 };
}

describe("library-union", () => {
  it("appends secondary-only ids after the primary order", () => {
    expect(unionTracksById([t(1), t(2)], [t(2), t(3)]).map((x) => x.id)).toEqual([
      1, 2, 3,
    ]);
  });

  it("compares track id sets, not order or metadata", () => {
    expect(trackIdSetEqual([t(1, "a"), t(2)], [t(2, "b"), t(1)])).toBe(true);
    expect(trackIdSetEqual([t(1)], [t(1), t(2)])).toBe(false);
    expect(trackIdSetEqual([], [])).toBe(true);
  });

  it("unions history on a structural 409 and keeps server fav/playlist", () => {
    const server = {
      playlist: [t(10)],
      favorites: [t(20)],
      history: [t(1), t(2)],
      curIdx: 0,
      revision: 8,
    };
    const local = { history: [t(9), t(1)] };
    const { next, historyDiverged } = resolveStructuralLibraryConflict(local, server);
    expect(next.playlist.map((x) => x.id)).toEqual([10]);
    expect(next.favorites.map((x) => x.id)).toEqual([20]);
    expect(next.history.map((x) => x.id)).toEqual([1, 2, 9]);
    expect(next.curIdx).toBe(0);
    expect(next.revision).toBe(8);
    expect(historyDiverged).toBe(true);
  });

  it("does not mark history diverged when the union matches the server", () => {
    const server = {
      playlist: [t(10)],
      favorites: [],
      history: [t(1), t(2)],
      curIdx: -1,
      revision: 3,
    };
    const { next, historyDiverged } = resolveStructuralLibraryConflict(
      { history: [t(1), t(2)] },
      server
    );
    expect(next.history.map((x) => x.id)).toEqual([1, 2]);
    expect(historyDiverged).toBe(false);
  });

  it("caps the unioned history at 2000", () => {
    const serverHist = Array.from({ length: 2000 }, (_, i) => t(i + 1));
    const { next, historyDiverged } = resolveStructuralLibraryConflict(
      { history: [t(9001)] },
      {
        playlist: [],
        favorites: [],
        history: serverHist,
        curIdx: -1,
        revision: 1,
      }
    );
    expect(next.history).toHaveLength(2000);
    expect(next.history.map((x) => x.id)).not.toContain(9001);
    expect(historyDiverged).toBe(false);
  });

  it("library persist uses the union helper instead of dropping local history", () => {
    const src = fs.readFileSync(
      path.join(root, "client/src/store/library-persist.ts"),
      "utf8"
    );
    expect(src).toMatch(/resolveStructuralLibraryConflict/);
    expect(src).toMatch(/historyDiverged/);
    expect(src).not.toMatch(/Real multi-device structural change — server wins/);
  });
});
