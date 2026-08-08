-- Short-TTL play URL cache (signed CDN links expire; refresh on miss/failure)
-- Free D1 only — never store audio bytes.
CREATE TABLE IF NOT EXISTS resolve_cache (
  sid TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  br INTEGER DEFAULT 0,
  size INTEGER DEFAULT 0,
  name TEXT DEFAULT '',
  artist TEXT DEFAULT '',
  cover TEXT DEFAULT '',
  source TEXT DEFAULT 'remote',
  expires_at REAL NOT NULL,
  updated_at REAL NOT NULL,
  PRIMARY KEY (sid, level)
);

CREATE INDEX IF NOT EXISTS idx_resolve_expires ON resolve_cache(expires_at);
