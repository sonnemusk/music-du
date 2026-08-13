# HTTP API reference

Base URL: same origin as the SPA (e.g. `https://your.domain` or `http://127.0.0.1:8787`).

Unless noted, responses are JSON:

```json
{ "ok": true, "data": … }
{ "ok": false, "error": "message" }
```

Status codes: `200` success · `4xx` client · `5xx` upstream/server.

---

## Auth

| Mechanism | Applies to | Header / cookie |
|-----------|------------|-----------------|
| **None (demo)** | Public demo: search, play, charts, `GET /api/library` | — |
| **Cloudflare Access (private only)** | Private hostname: whole site including library writes | Access JWT / CI service token |
| **`LIBRARY_READONLY=true` (demo only)** | Demo writes, `/favs`, `/import` | Always **403** |

Demo must not sit behind Access. Private site uses Access only — no `X-Music-Token`.

---

## System

### `GET /api/health`

Liveness + feature flags.

**Response `data` fields (Worker):**

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | Always true if process up |
| `service` | string | `"music"` |
| `runtime` | string | `cloudflare-workers` or `node-hono` |
| `provider` | string | Upstream adapter id (`chksz`) |
| `has_apikey` | boolean | Fallback keys configured |
| `has_d1` | boolean | D1 bound (Worker) |
| `library_auth` | boolean | Always false (no app token) |
| `readOnly` | boolean | Demo public read-only Worker |
| `project` | string | `music-du` / `music-du-demo` |
| `policy` | object | Free-tier / library policy hints |
| `version` | number | API version |

**Node** returns a smaller subset (`has_apikey`, `runtime`, …).

---

## Discovery

### `GET /api/search`

| Query | Default | Description |
|-------|---------|-------------|
| `q` or `keyword` | `""` | Search string |
| `limit` | `30` | Max results |

**Response:** `{ ok, data: Track[] }`

`Track` (normalized):

```ts
{
  id: string | number
  name: string
  artist: string
  album?: string
  cover?: string
  duration?: number  // seconds
  // optional quality hints when resolved
  level?: string
  br?: number
  size?: number
}
```

### `GET /api/charts`

Lists chart platforms + board types.

**Response:**

```json
{
  "ok": true,
  "data": {
    "platforms": [{ "id": "netease", "name": "…" }, …],
    "boards": [{ "id": "soar", "name": "飙升" }, …],
    "defaultBoard": "soar"
  }
}
```

### `GET /api/charts/:platform`

| Param / query | Description |
|---------------|-------------|
| `platform` | e.g. `netease`, `qq`, `kugou`, `kuwo`, `douyin`, … |
| `board` / `type` | `soar` \| `hot` \| `new` (default `soar`) |
| `limit` | default `40` |
| `force` / `refresh` | `1` to bypass cache |

**Response:** chart payload with `tracks`, `board`, `sourceLabel`, `updatedAt`, etc.

---

## Playback

### `GET /api/song/:sid`

Resolve a playable URL for song id.

| Query | Description |
|-------|-------------|
| `level` | Quality id (`standard`, `exhigh`, `lossless`, `jymaster`, …) |
| `force` | `1` force re-resolve (skip cache) |

**Response `data` (typical):**

```json
{
  "id": "1901371647",
  "url": "https://cdn.example/…mp3",
  "level": "standard",
  "br": 128000,
  "size": 4096941,
  "name": "…",
  "artist": "…",
  "cover": "https://…",
  "source": "remote",
  "stream": "/api/stream/1901371647?level=standard",
  "play": { "src": "https://…", "mode": "remote" }
}
```

- Browser prefers `url` / `play.src` (direct CDN).  
- On Cloudflare, audio is **not** proxied as bytes.

### `GET /api/song/:sid/qualities`

Probe available quality levels (may hit upstream multiple times).

**Response:** `{ ok, data: QualityChoice[] }` — each with `level`, optional `url` / labels.

### `GET /api/stream/:sid`

| Query | Description |
|-------|-------------|
| `level` | Quality |

**Worker:** **HTTP 302** redirect to remote URL (no body cache).  
**Node:** may proxy bytes for local blob caching (dev/VPS).

### `GET /api/lyric/:sid`

| Query | Description |
|-------|-------------|
| `name`, `artist` | Optional meta for multi-source match |
| `duration` | Optional seconds |

**Response:** `{ ok, data: { lrc?, tlrc?, … } }`

### `GET /api/cover-proxy?url=`

Proxies an allowed cover image URL (size / host allowlist). Used when the CDN blocks hotlinking.

---

## Library

Library stores **metadata only** (ids, names, covers) — not audio files.

### `GET /api/library`

Private installs: same Cloudflare Access session as the rest of the site. Demo: public GET, writes 403.

**Response:**

```json
{
  "ok": true,
  "readOnly": false,
  "data": {
    "playlist": [Track],
    "favorites": [Track],
    "history": [Track],
    "curIdx": 0,
    "revision": 12
  }
}
```

| Field | Description |
|-------|-------------|
| `revision` | Optimistic concurrency counter (D1 / SQLite meta) |

### `PUT /api/library`

Merge client lists into server store.

**Headers:** `Content-Type: application/json`

**Body:**

```json
{
  "playlist": [Track],
  "favorites": [Track],
  "history": [Track],
  "curIdx": 0,
  "revision": 12,
  "forceClearPlaylist": false,
  "forceClearFavorites": false,
  "forceClearHistory": false
}
```

| Flag | Behavior |
|------|----------|
| (default) | **Union** merge by id (server keeps rows client omitted) |
| `forceClear*` | Replace that list with client payload |

**409 Conflict** when `revision` does not match server:

```json
{
  "ok": false,
  "error": "library conflict — reload and retry",
  "conflict": true,
  "data": { /* current library + revision */ }
}
```

**403** when `LIBRARY_READONLY=true`.

### `DELETE /api/library/:listType/:sid`

| Param | Values |
|-------|--------|
| `listType` | `playlist` \| `favorites` \| `history` |
| `sid` | Track id |

| Query | Description |
|-------|-------------|
| `revision` | Expected revision (optional but recommended) |

**409** on revision mismatch · **403** if read-only.

---

## Import / export (Worker + Node where implemented)

### `GET /favs` · `GET /export`

Download favorites as JSON attachment:

```json
{
  "exportedAt": "ISO-8601",
  "source": "host",
  "count": 10,
  "favorites": [{ "id", "name", "artist", "album", "cover", "duration" }]
}
```

- Protect with edge Access on private installs.  
- **403** in demo read-only mode.

### `GET /import`

HTML form (multipart). **403** if read-only.

### `POST /import`

`multipart/form-data` field `file`:

1. **`/favs` export JSON** — merge by track **id** (dedupe)  
2. **Text / CSV** — lines `歌名` or `歌名 - 作者` → search match (capped per request)

**Success without failures:** `303` redirect to `/?imported=&total=&skipped=&matched=&failed=&capped=`  
**Partial name-match failures:** HTML page listing unmatched lines (max 200 shown).

---

## Client-only (not HTTP)

Stored in **browser `localStorage`** (not D1):

- Theme / skin  
- Volume, mute, play mode  
- Optional resolve / lyric caches  
- Optional `music.accessToken`

---

## Errors (common)

| Status | Meaning |
|--------|---------|
| 403 | Read-only demo / export disabled |
| 404 | Song resolve miss |
| 409 | Library revision conflict |
| 429 | Upstream rate limit |
| 502/503 | Upstream or D1 not configured |

---

## OpenAPI-style quick index

| Method | Path |
|--------|------|
| GET | `/api/health` |
| GET | `/api/search` |
| GET | `/api/charts` |
| GET | `/api/charts/:platform` |
| GET | `/api/song/:sid` |
| GET | `/api/song/:sid/qualities` |
| GET | `/api/stream/:sid` |
| GET | `/api/lyric/:sid` |
| GET | `/api/cover-proxy` |
| GET | `/api/library` |
| PUT | `/api/library` |
| DELETE | `/api/library/:listType/:sid` |
| GET | `/favs` `/export` |
| GET/POST | `/import` |

> Note: `/api/library/import` (and HTML import UI) are **Worker-only**; Node `createApp` does not expose them.
