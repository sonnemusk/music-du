import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SAVE_FAST_MS, SAVE_SLOW_MS } from "../client/src/store/library-persist.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("library persist extract", () => {
  it("keeps the two-speed save timings", () => {
    expect(SAVE_FAST_MS).toBe(500);
    expect(SAVE_SLOW_MS).toBe(20_000);
  });

  it("moves persist out of the main player store", () => {
    const player = fs.readFileSync(path.join(root, "client/src/store/player.ts"), "utf8");
    const persist = fs.readFileSync(
      path.join(root, "client/src/store/library-persist.ts"),
      "utf8"
    );
    expect(player).toMatch(/from "\.\/library-persist"/);
    expect(player).toMatch(/bindLibraryPersistSet/);
    expect(player).not.toMatch(/function persistSoon/);
    expect(player).not.toMatch(/function flushLibrarySave/);
    expect(player).not.toMatch(/function applyLib/);
    expect(persist).toMatch(/export function persistSoon/);
    expect(persist).toMatch(/export async function flushLibrarySave/);
    expect(persist).toMatch(/export function applyLib/);
  });
});
