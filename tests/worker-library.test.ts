/**
 * Worker library route matrix (Q-3) — mock Env + in-memory D1-ish store.
 * Avoids wrangler unstable_dev; exercises the same Hono app as production.
 */
import { describe, expect, it } from "vitest";
import { workerApp, type WorkerEnv } from "../server/worker.js";

type Row = Record<string, unknown>;

/** Minimal D1 mock: library_tracks + library_meta + ignore DDL */
function createMockD1() {
  const tracks = new Map<string, Row>(); // key list_type|sid
  const meta = new Map<string, string>();

  const api = {
    prepare(sql: string) {
      const s = sql.replace(/\s+/g, " ").trim();
      let binds: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          binds = args;
          return stmt;
        },
        async run() {
          if (/^CREATE TABLE/i.test(s) || /^CREATE INDEX/i.test(s)) {
            return { success: true };
          }
          if (/INSERT OR REPLACE INTO library_tracks/i.test(s)) {
            const [list_type, sid, pos, name, artist, album, cover, duration, level, br, size, cached, updated_at] =
              binds as any[];
            tracks.set(`${list_type}|${sid}`, {
              list_type,
              sid,
              pos,
              name,
              artist,
              album,
              cover,
              duration,
              level,
              br,
              size,
              cached,
              updated_at,
            });
            return { success: true };
          }
          if (/DELETE FROM library_tracks WHERE list_type=\? AND sid=\?/i.test(s)) {
            tracks.delete(`${binds[0]}|${binds[1]}`);
            return { success: true };
          }
          if (/DELETE FROM library_tracks WHERE list_type=\? AND updated_at </i.test(s)) {
            const lt = binds[0];
            const cut = Number(binds[1]);
            for (const [k, row] of [...tracks.entries()]) {
              if (row.list_type === lt && Number(row.updated_at) < cut) tracks.delete(k);
            }
            return { success: true };
          }
          if (/INSERT OR REPLACE INTO library_meta/i.test(s)) {
            if (binds.length >= 2) meta.set(String(binds[0]), String(binds[1]));
            return { success: true };
          }
          if (/UPDATE library_tracks SET pos=\?/i.test(s)) {
            const [pos, list_type, sid] = binds as any[];
            const row = tracks.get(`${list_type}|${sid}`);
            if (row) row.pos = pos;
            return { success: true };
          }
          return { success: true };
        },
        async all() {
          if (/SELECT \* FROM library_tracks WHERE list_type=\?/i.test(s)) {
            const lt = binds[0];
            const results = [...tracks.values()]
              .filter((r) => r.list_type === lt)
              .sort((a, b) => Number(a.pos) - Number(b.pos));
            return { results };
          }
          if (/SELECT sid FROM library_tracks WHERE list_type=\?/i.test(s)) {
            const lt = binds[0];
            const results = [...tracks.values()]
              .filter((r) => r.list_type === lt)
              .sort((a, b) => Number(a.pos) - Number(b.pos))
              .map((r) => ({ sid: r.sid }));
            return { results };
          }
          if (/SELECT sid, pos FROM library_tracks WHERE list_type=\?/i.test(s)) {
            const lt = binds[0];
            const results = [...tracks.values()]
              .filter((r) => r.list_type === lt)
              .map((r) => ({ sid: r.sid, pos: r.pos }));
            return { results };
          }
          return { results: [] };
        },
        async first<T>() {
          if (/library_meta/i.test(s) && /SELECT value/i.test(s)) {
            let k = binds.length ? String(binds[0]) : "";
            if (!k) {
              const m = s.match(/key=['"]?(\w+)['"]?/);
              if (m) k = m[1];
            }
            const value = meta.get(k);
            return (value != null ? { value } : null) as T;
          }
          return null as T;
        },
      };
      return stmt;
    },
    async batch(stmts: { run: () => Promise<unknown> }[]) {
      for (const st of stmts) await st.run();
      return [];
    },
  };
  return api as unknown as D1Database;
}

function env(partial: Partial<WorkerEnv> & { MUSIC_DU_DB?: D1Database | null }): WorkerEnv {
  return {
    CHKSZ_API_BASE: "https://api.chksz.top",
    CHKSZ_FALLBACK_BASE: "https://api.chksz.com",
    ...partial,
  } as WorkerEnv;
}

async function req(
  path: string,
  init: RequestInit & { env: WorkerEnv }
): Promise<Response> {
  const { env: e, ...rest } = init;
  return workerApp.fetch(new Request(`https://example.test${path}`, rest), e, {
    waitUntil() {},
    passThroughOnException() {},
  } as ExecutionContext);
}

describe("worker library routes", () => {
  it("readonly demo: GET strips history/curIdx; PUT is 403", async () => {
    const db = createMockD1();
    // seed via ensure path: put favorites + history through raw map
    // use PUT won't work on readonly — seed by prepare insert
    await db
      .prepare(
        `INSERT OR REPLACE INTO library_tracks
         (list_type,sid,pos,name,artist,album,cover,duration,level,br,size,cached,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind("favorites", "1", 0, "A", "Art", "", "", 0, "", 0, 0, 0, 1)
      .run();
    await db
      .prepare(
        `INSERT OR REPLACE INTO library_tracks
         (list_type,sid,pos,name,artist,album,cover,duration,level,br,size,cached,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind("history", "9", 0, "H", "Art", "", "", 0, "", 0, 0, 0, 1)
      .run();
    await db
      .prepare(`INSERT OR REPLACE INTO library_meta (key, value) VALUES (?, ?)`)
      .bind("curIdx", "3")
      .run();
    await db
      .prepare(`INSERT OR REPLACE INTO library_meta (key, value) VALUES (?, ?)`)
      .bind("revision", "1")
      .run();

    const e = env({ MUSIC_DU_DB: db, LIBRARY_READONLY: "true" });
    const get = await req("/api/library", { method: "GET", env: e });
    expect(get.status).toBe(200);
    const gj = await get.json();
    expect(gj.ok).toBe(true);
    expect(gj.readOnly).toBe(true);
    expect(gj.data.favorites?.length).toBe(1);
    expect(gj.data).not.toHaveProperty("history");
    expect(gj.data).not.toHaveProperty("curIdx");

    const put = await req("/api/library", {
      method: "PUT",
      env: e,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorites: [], history: [], playlist: [], curIdx: 0 }),
    });
    expect(put.status).toBe(403);
  });

  it("private: no token → 401 when MUSIC_ACCESS_TOKEN set", async () => {
    const e = env({
      MUSIC_DU_DB: createMockD1(),
      MUSIC_ACCESS_TOKEN: "s3cret",
    });
    const r = await req("/api/library", { method: "GET", env: e });
    expect(r.status).toBe(401);
  });

  it("private: with token → GET ok; history present", async () => {
    const db = createMockD1();
    await db
      .prepare(
        `INSERT OR REPLACE INTO library_tracks
         (list_type,sid,pos,name,artist,album,cover,duration,level,br,size,cached,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .bind("history", "2", 0, "Song", "A", "", "", 0, "", 0, 0, 0, 1)
      .run();
    await db
      .prepare(`INSERT OR REPLACE INTO library_meta (key, value) VALUES (?, ?)`)
      .bind("revision", "0")
      .run();

    const e = env({ MUSIC_DU_DB: db, MUSIC_ACCESS_TOKEN: "s3cret" });
    const r = await req("/api/library", {
      method: "GET",
      env: e,
      headers: { "X-Music-Token": "s3cret" },
    });
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data.history?.length).toBe(1);
    expect(j.readOnly).toBe(false);
  });

  it("missing D1 → 503 localOnly", async () => {
    const e = env({ MUSIC_DU_DB: undefined as any, MUSIC_ACCESS_TOKEN: "" });
    const r = await req("/api/library", { method: "GET", env: e });
    expect(r.status).toBe(503);
    const j = await r.json();
    expect(j.localOnly).toBe(true);
  });
});
