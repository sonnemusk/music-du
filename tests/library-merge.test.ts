import { describe, expect, it } from "vitest";
import {
  libraryRevisionOk,
  libraryTokenOk,
  mergeTrackList,
  nextLibraryRevision,
  planListUpserts,
  sanitizeLibTrack,
  unionTracksById,
} from "../server/library-merge.js";
import { parseFavoritesImport } from "../client/src/lib/library-union.js";

describe("library merge (D1 write path)", () => {
  it("merge keeps server-only rows when client is thinner", () => {
    const existing = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
      { id: 3, name: "C" },
    ];
    const incoming = [{ id: 2, name: "B2" }];
    const out = mergeTrackList(existing, incoming, false, 2000);
    expect(out.map((t) => t.id)).toEqual([2, 1, 3]);
    expect(out[0].name).toBe("B2");
  });

  it("forceClear drops server rows not in incoming", () => {
    const existing = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ];
    const out = mergeTrackList(existing, [{ id: 9, name: "Z" }], true, 2000);
    expect(out.map((t) => t.id)).toEqual([9]);
  });

  it("empty incoming without forceClear keeps existing", () => {
    const existing = [{ id: 1, name: "A" }];
    expect(mergeTrackList(existing, [], false, 2000)).toEqual(existing);
    expect(mergeTrackList(existing, undefined, false, 2000)).toEqual(existing);
  });

  it("respects cap", () => {
    const existing = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }));
    const incoming = Array.from({ length: 5 }, (_, i) => ({ id: 100 + i }));
    const out = mergeTrackList(existing, incoming, false, 7);
    expect(out).toHaveLength(7);
    expect(out.slice(0, 5).map((t) => t.id)).toEqual([100, 101, 102, 103, 104]);
  });

  it("planListUpserts dedupes and caps without wipe-first", () => {
    const plan = planListUpserts(
      [
        { id: 1, name: "a" },
        { id: 1, name: "dup" },
        { id: 2, name: "b" },
        null,
        { id: "", name: "bad" },
      ],
      10
    );
    expect(plan.map((p) => p.sid)).toEqual(["1", "2"]);
    expect(plan[0].pos).toBe(0);
    expect(plan[1].pos).toBe(1);
    expect(plan[0].track.name).toBe("a");
  });

  it("sanitizeLibTrack rejects empty id", () => {
    expect(sanitizeLibTrack(null)).toBeNull();
    expect(sanitizeLibTrack({ name: "x" })).toBeNull();
    expect(sanitizeLibTrack({ id: 42, name: "ok" })?.id).toBe(42);
  });
});

describe("library token gate", () => {
  it("allows when no expected secret (dev)", () => {
    expect(libraryTokenOk("", "x")).toBe(true);
    expect(libraryTokenOk(undefined, undefined)).toBe(true);
  });

  it("requires exact match when secret set", () => {
    expect(libraryTokenOk("secret", "secret")).toBe(true);
    expect(libraryTokenOk("secret", "nope")).toBe(false);
    expect(libraryTokenOk("secret", "")).toBe(false);
    expect(libraryTokenOk("secret", undefined)).toBe(false);
  });
});

describe("library revision (optimistic concurrency)", () => {
  it("allows missing client revision (legacy)", () => {
    expect(libraryRevisionOk(5, null)).toBe(true);
    expect(libraryRevisionOk(5, undefined)).toBe(true);
  });

  it("allows matching revision", () => {
    expect(libraryRevisionOk(3, 3)).toBe(true);
  });

  it("rejects stale client revision", () => {
    expect(libraryRevisionOk(4, 3)).toBe(false);
    expect(libraryRevisionOk(1, 0)).toBe(false);
  });

  it("bumps monotone", () => {
    expect(nextLibraryRevision(0)).toBe(1);
    expect(nextLibraryRevision(9)).toBe(10);
  });
});

describe("union + import", () => {
  it("unionTracksById prefers primary order", () => {
    const a = unionTracksById(
      [{ id: 1, name: "A" }, { id: 2, name: "B" }],
      [{ id: 2, name: "B2" }, { id: 3, name: "C" }]
    );
    expect(a.map((t) => t.id)).toEqual([1, 2, 3]);
    expect(a[1].name).toBe("B");
  });

  it("parseFavoritesImport accepts export shape only", () => {
    const ok = parseFavoritesImport({
      count: 2,
      favorites: [
        { id: 10, name: "X", artist: "Y" },
        { id: 10, name: "dup" },
        { id: 11, name: "Z", artist: "W" },
      ],
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.tracks).toHaveLength(2);
      expect(ok.tracks[0].id).toBe(10);
    }
    expect(parseFavoritesImport([{ id: 1 }]).ok).toBe(false);
  });
});

/** Lightweight D1-shaped mock for revision conflict flow (no paid CF). */
describe("mock D1 revision flow", () => {
  it("conflict when client rev stale", () => {
    let rev = 2;
    const store = [{ id: 1, name: "A" }];
    const put = (clientRev: number | null, incoming: { id: number; name: string }[]) => {
      if (!libraryRevisionOk(rev, clientRev)) {
        return { status: 409 as const, data: { favorites: store, revision: rev } };
      }
      store.splice(0, store.length, ...incoming);
      rev = nextLibraryRevision(rev);
      return { status: 200 as const, data: { favorites: [...store], revision: rev } };
    };
    expect(put(1, [{ id: 9, name: "Z" }]).status).toBe(409);
    expect(put(2, [{ id: 9, name: "Z" }]).status).toBe(200);
    expect(rev).toBe(3);
  });
});
