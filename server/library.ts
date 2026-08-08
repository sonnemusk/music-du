/**
 * SQLite library via node:sqlite (Node 22+) for VPS/local.
 * D1 adapter used on Cloudflare Workers.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { dataDir, libraryDbPath } from "./config.js";
import type { Library, Track } from "./types.js";

const LIST_CAPS = { playlist: 500, favorites: 500, history: 300 } as const;
export type ListType = keyof typeof LIST_CAPS;

export function emptyLibrary(): Library {
  return { playlist: [], favorites: [], history: [], curIdx: -1 };
}

export function sanitizeTrack(t: any): Track | null {
  if (!t || t.id == null || t.id === "") return null;
  return {
    id: t.id,
    name: String(t.name || ""),
    artist: String(t.artist || ""),
    album: String(t.album || ""),
    cover: String(t.cover || ""),
    duration: Number(t.duration || 0),
    level: String(t.level || ""),
    br: Number(t.br || 0),
    size: Number(t.size || 0),
  };
}

function dedupe(tracks: any[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const raw of tracks || []) {
    const t = sanitizeTrack(raw);
    if (!t) continue;
    const k = String(t.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function sidOut(sid: string): string | number {
  if (/^\d+$/.test(sid)) {
    const n = Number(sid);
    if (Number.isSafeInteger(n)) return n;
  }
  return sid;
}

export class SqliteLibrary {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || libraryDbPath();
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec("PRAGMA synchronous=NORMAL");
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS library_tracks (
        list_type TEXT NOT NULL,
        sid TEXT NOT NULL,
        pos INTEGER NOT NULL,
        name TEXT DEFAULT '',
        artist TEXT DEFAULT '',
        album TEXT DEFAULT '',
        cover TEXT DEFAULT '',
        duration INTEGER DEFAULT 0,
        level TEXT DEFAULT '',
        br INTEGER DEFAULT 0,
        size INTEGER DEFAULT 0,
        cached INTEGER DEFAULT 0,
        updated_at REAL DEFAULT 0,
        PRIMARY KEY (list_type, sid)
      );
      CREATE INDEX IF NOT EXISTS idx_lib_type_pos ON library_tracks(list_type, pos);
      CREATE TABLE IF NOT EXISTS library_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private writeList(listType: ListType, tracks: any[]) {
    this.db.prepare("DELETE FROM library_tracks WHERE list_type=?").run(listType);
    const cap = LIST_CAPS[listType];
    const now = Date.now() / 1000;
    const insert = this.db.prepare(
      `INSERT INTO library_tracks
       (list_type,sid,pos,name,artist,album,cover,duration,level,br,size,cached,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
    let pos = 0;
    for (const t of dedupe(tracks)) {
      if (pos >= cap) break;
      insert.run(
        listType,
        String(t.id),
        pos,
        t.name,
        t.artist,
        t.album,
        t.cover,
        t.duration || 0,
        t.level || "",
        t.br || 0,
        t.size || 0,
        0,
        now
      );
      pos++;
    }
  }

  private readList(listType: ListType): Track[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM library_tracks WHERE list_type=? ORDER BY pos ASC LIMIT ?`
      )
      .all(listType, LIST_CAPS[listType]) as any[];
    return rows.map((r) => ({
      id: sidOut(String(r.sid)),
      name: r.name || "",
      artist: r.artist || "",
      album: r.album || "",
      cover: r.cover || "",
      duration: r.duration || 0,
      level: r.level || "",
      br: r.br || 0,
      size: r.size || 0,
    }));
  }

  load(): Library {
    const playlist = this.readList("playlist");
    const favorites = this.readList("favorites");
    const history = this.readList("history");
    const row = this.db
      .prepare(`SELECT value FROM library_meta WHERE key='curIdx'`)
      .get() as { value: string } | undefined;
    let curIdx = row ? parseInt(row.value, 10) : -1;
    if (Number.isNaN(curIdx) || curIdx >= playlist.length) {
      curIdx = playlist.length ? 0 : -1;
    }
    return { playlist, favorites, history, curIdx };
  }

  save(data: Partial<Library>): Library {
    const payload: Library = {
      playlist: dedupe(data.playlist || []).slice(0, LIST_CAPS.playlist),
      favorites: dedupe(data.favorites || []).slice(0, LIST_CAPS.favorites),
      history: dedupe(data.history || []).slice(0, LIST_CAPS.history),
      curIdx: Number(data.curIdx ?? -1),
    };
    if (Number.isNaN(payload.curIdx) || payload.curIdx >= payload.playlist.length) {
      payload.curIdx = payload.playlist.length ? 0 : -1;
    }
    this.writeList("playlist", payload.playlist);
    this.writeList("favorites", payload.favorites);
    this.writeList("history", payload.history);
    this.db
      .prepare(`INSERT OR REPLACE INTO library_meta(key,value) VALUES('curIdx',?)`)
      .run(String(payload.curIdx));
    try {
      fs.writeFileSync(
        path.join(dataDir(), "library.json"),
        JSON.stringify(payload, null, 0),
        "utf8"
      );
    } catch {
      /* ignore mirror */
    }
    return payload;
  }

  mergePut(
    incoming: any,
    force: {
      forceClearPlaylist?: boolean;
      forceClearFavorites?: boolean;
      forceClearHistory?: boolean;
    } = {}
  ): Library {
    const existing = this.load();
    const inPl = dedupe(incoming.playlist || []);
    const inFav = dedupe(incoming.favorites || []);
    const inHi = dedupe(incoming.history || []);

    /** Union-merge unless force-clear — removals go through deleteSid. */
    const mergeKeep = (
      prev: Track[],
      next: Track[],
      forceClear: boolean,
      cap: number
    ): Track[] => {
      if (forceClear) return next.slice(0, cap);
      if (!next.length) return prev;
      const seen = new Set<string>();
      const out: Track[] = [];
      for (const t of next) {
        const k = String(t.id);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
        if (out.length >= cap) return out;
      }
      for (const t of prev) {
        const k = String(t.id);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
        if (out.length >= cap) break;
      }
      return out;
    };

    const pl = mergeKeep(
      existing.playlist,
      inPl,
      Boolean(force.forceClearPlaylist),
      LIST_CAPS.playlist
    );
    const fav = mergeKeep(
      existing.favorites,
      inFav,
      Boolean(force.forceClearFavorites),
      LIST_CAPS.favorites
    );

    let hi = existing.history;
    if (force.forceClearHistory) hi = inHi.slice(0, LIST_CAPS.history);
    else if (inHi.length) {
      const seen = new Set<string>();
      hi = [];
      for (const t of [...inHi, ...existing.history]) {
        const k = String(t.id);
        if (seen.has(k)) continue;
        seen.add(k);
        hi.push(t);
        if (hi.length >= LIST_CAPS.history) break;
      }
    }

    let curIdx = Number(incoming.curIdx ?? existing.curIdx);
    if (Number.isNaN(curIdx) || curIdx >= pl.length) curIdx = pl.length ? 0 : -1;
    return this.save({ playlist: pl, favorites: fav, history: hi, curIdx });
  }

  deleteSid(listType: ListType, sid: string | number): Library {
    if (!(listType in LIST_CAPS)) throw new Error(`bad list_type: ${listType}`);
    this.db
      .prepare(`DELETE FROM library_tracks WHERE list_type=? AND sid=?`)
      .run(listType, String(sid));
    const rows = this.db
      .prepare(`SELECT sid FROM library_tracks WHERE list_type=? ORDER BY pos ASC`)
      .all(listType) as { sid: string }[];
    const upd = this.db.prepare(
      `UPDATE library_tracks SET pos=? WHERE list_type=? AND sid=?`
    );
    rows.forEach((r, i) => upd.run(i, listType, r.sid));
    if (listType === "playlist") {
      const row = this.db
        .prepare(`SELECT value FROM library_meta WHERE key='curIdx'`)
        .get() as { value: string } | undefined;
      let cur = row ? parseInt(row.value, 10) : -1;
      if (Number.isNaN(cur) || cur >= rows.length) cur = rows.length ? rows.length - 1 : -1;
      this.db
        .prepare(`INSERT OR REPLACE INTO library_meta(key,value) VALUES('curIdx',?)`)
        .run(String(cur));
    }
    return this.load();
  }
}

let singleton: SqliteLibrary | null = null;

export function getLibrary(dbPath?: string): SqliteLibrary {
  if (dbPath) return new SqliteLibrary(dbPath);
  if (!singleton) singleton = new SqliteLibrary();
  return singleton;
}

/** Test helper: reset singleton */
export function resetLibrarySingleton() {
  singleton = null;
}
