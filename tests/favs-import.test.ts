import { describe, expect, it } from "vitest";
import {
  countNewFavorites,
  isFavsExportShape,
  parseFavsExportJson,
} from "../server/favs-import.js";
import { parseFavoritesImport } from "../client/src/lib/library-union.js";

describe("favs export format only", () => {
  it("accepts /favs export shape", () => {
    const raw = {
      exportedAt: "2026-08-08T00:00:00.000Z",
      source: "music.dubin.cc",
      count: 2,
      favorites: [
        { id: 1, name: "A", artist: "X", album: "", cover: "", duration: 1 },
        { id: 2, name: "B", artist: "Y", album: "", cover: "", duration: 2 },
      ],
    };
    expect(isFavsExportShape(raw)).toBe(true);
    const p = parseFavsExportJson(raw);
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.tracks).toHaveLength(2);
  });

  it("rejects bare array and foreign shapes", () => {
    expect(parseFavsExportJson([{ id: 1 }]).ok).toBe(false);
    expect(parseFavsExportJson({ tracks: [{ id: 1 }] }).ok).toBe(false);
    expect(parseFavsExportJson({ data: { favorites: [] } }).ok).toBe(false);
    expect(parseFavoritesImport([{ id: 1 }]).ok).toBe(false);
  });

  it("dedupes within file by id", () => {
    const p = parseFavsExportJson({
      favorites: [
        { id: 1, name: "A", artist: "", album: "", cover: "", duration: 0 },
        { id: 1, name: "dup", artist: "", album: "", cover: "", duration: 0 },
        { id: 2, name: "B", artist: "", album: "", cover: "", duration: 0 },
      ],
    });
    expect(p.ok && p.tracks.map((t) => t.id)).toEqual([1, 2]);
  });

  it("countNewFavorites ignores existing ids", () => {
    const n = countNewFavorites(
      [{ id: 1 }, { id: 2 }],
      [{ id: 2 }, { id: 3 }, { id: 3 }, { id: 1 }]
    );
    expect(n).toBe(1);
  });
});
