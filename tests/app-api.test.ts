import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import * as chksz from "../server/chksz.js";
import { SqliteLibrary } from "../server/library.js";

const tmpDirs: string[] = [];
afterEach(() => {
  chksz.setHttpTransport(null);
  for (const d of tmpDirs) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* */
    }
  }
  tmpDirs.length = 0;
});

function tmpLib() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "kazam-api-"));
  tmpDirs.push(d);
  return new SqliteLibrary(path.join(d, "library.db"));
}

describe("Hono app API", () => {
  it("favs export is JSON, not the SPA shell", async () => {
    const app = createApp({ library: tmpLib(), apikey: "", readonly: false });
    const r = await app.request("/favs");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type") || "").toContain("application/json");
    const j = await r.json();
    expect(Array.isArray(j.favorites)).toBe(true);
    expect(typeof j.count).toBe("number");
  });

  it("health", async () => {
    const app = createApp({ library: tmpLib(), apikey: "", readonly: false });
    const r = await app.request("/api/health");
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.service).toBe("music");
    expect(j.has_apikey).toBe(false);
    expect(j.demo).toBe(false);
    expect(j.project).toBe("music-du");
  });

  it("charts platforms list", async () => {
    const app = createApp({ library: tmpLib(), apikey: "x", readonly: false });
    const r = await app.request("/api/charts");
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data.platforms.length).toBeGreaterThanOrEqual(5);
  });

  it("charts unknown platform 400", async () => {
    const app = createApp({ library: tmpLib(), apikey: "x", readonly: false });
    const r = await app.request("/api/charts/not-a-platform");
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.ok).toBe(false);
  });

  it("search without key is allowed (free .top primary)", async () => {
    // free primary needs no apikey; without transport, real upstream may 200 or soft-fail
    const app = createApp({ library: tmpLib(), apikey: "", readonly: false });
    // inject transport so test is offline-stable
    const chksz = await import("../server/chksz.js");
    chksz.setHttpTransport(async () => ({
      status: 200,
      json: async () => ({
        code: 200,
        data: [{ id: 1, name: "T", ar: [{ name: "A" }], al: { name: "", picUrl: "" }, duration: 1 }],
      }),
    }));
    try {
      const r = await app.request("/api/search?q=test");
      expect(r.status).toBe(200);
      const j = await r.json();
      expect(j.ok).toBe(true);
      expect(Array.isArray(j.data)).toBe(true);
    } finally {
      chksz.setHttpTransport(null);
    }
  });

  it("library history DELETE sticks", async () => {
    const app = createApp({ library: tmpLib(), apikey: "x", readonly: false });
    const put = await app.request("/api/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playlist: [],
        favorites: [],
        history: [
          { id: 501, name: "H1", artist: "A" },
          { id: 502, name: "H2", artist: "B" },
          { id: 503, name: "H3", artist: "C" },
        ],
        curIdx: -1,
        forceClearHistory: true,
      }),
    });
    expect(put.status).toBe(200);
    const del = await app.request("/api/library/history/502", { method: "DELETE" });
    expect(del.status).toBe(200);
    const body = await del.json();
    expect(body.data.history.map((t: any) => String(t.id))).not.toContain("502");
    const get = await app.request("/api/library");
    const again = await get.json();
    expect(again.data.history.map((t: any) => String(t.id))).not.toContain("502");
  });

  it("search via app with transport", async () => {
    chksz.setHttpTransport(async () => ({
      status: 200,
      json: async () => ({
        code: 200,
        data: [{ id: 9, name: "T", ar: [{ name: "A" }], al: { name: "Al", picUrl: "http://x" } }],
      }),
    }));
    const app = createApp({ library: tmpLib(), apikey: "chksz_test_fixture_key", readonly: false });
    const r = await app.request("/api/search?q=hello");
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data[0].name).toBe("T");
    expect(j.data[0].artist).toContain("A");
  });
});
