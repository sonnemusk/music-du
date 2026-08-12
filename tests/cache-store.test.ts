import { describe, expect, it, beforeEach } from "vitest";
import {
  getTimed,
  prunePrefix,
  setTimed,
  writeMapStore,
  readMapStore,
} from "../client/src/lib/cache-store.js";

// minimal localStorage polyfill for node
const store = new Map<string, string>();
const ls = {
  get length() {
    return store.size;
  },
  key(i: number) {
    return [...store.keys()][i] ?? null;
  },
  getItem(k: string) {
    return store.has(k) ? store.get(k)! : null;
  },
  setItem(k: string, v: string) {
    store.set(k, String(v));
  },
  removeItem(k: string) {
    store.delete(k);
  },
  clear() {
    store.clear();
  },
};
// @ts-expect-error assign global
globalThis.localStorage = ls;

describe("cache-store F-10f", () => {
  beforeEach(() => {
    store.clear();
  });

  it("getTimed respects soft TTL flag", () => {
    setTimed("k1", { x: 1 });
    const hit = getTimed<{ x: number }>("k1", 60_000, 120_000);
    expect(hit?.data.x).toBe(1);
    expect(hit?.stale).toBe(false);
  });

  it("prunePrefix keeps newest N", () => {
    for (let i = 0; i < 5; i++) setTimed(`pref.${i}`, i);
    prunePrefix("pref.", 2);
    let n = 0;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith("pref.")) n++;
    }
    expect(n).toBeLessThanOrEqual(2);
  });

  it("map store prunes by ts and max", () => {
    writeMapStore(
      "map1",
      {
        a: { ts: Date.now(), v: 1 },
        b: { ts: Date.now() - 1000, v: 2 },
        c: { ts: Date.now() - 2000, v: 3 },
      },
      { ttlMs: 60_000, max: 2 }
    );
    const m = readMapStore<{ ts: number; v: number }>("map1");
    expect(Object.keys(m).length).toBe(2);
    expect(m.a?.v).toBe(1);
  });
});
