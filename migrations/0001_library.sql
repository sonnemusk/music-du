-- Free D1 library schema (Cloudflare). Applied via:
--   wrangler d1 migrations apply kazam-library --remote
-- Worker also runs CREATE IF NOT EXISTS on first use.

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

CREATE TABLE IF NOT EXISTS library_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_tracks_list_pos
  ON library_tracks (list_type, pos);
