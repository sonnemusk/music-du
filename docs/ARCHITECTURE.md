# Architecture

SPA + BFF music player. Production path is **Cloudflare Workers free tier** (no R2 / paid KV). Node is for local, VPS, and Fly.

## Runtime

| Layer | Role |
|-------|------|
| **Browser** | React + Zustand; resolve/lyric caches; skins |
| **Worker** (`server/worker.ts`) | Production BFF: search, song, lyric, charts, D1 library, cover Cache API, `/favs` / `/import` |
| **Node** (`server/node.ts` + `app.ts`) | Local / VPS / Docker: SQLite library, disk chart/cover cache, optional stream proxy |

```
SPA ──same-origin /api/*──► BFF
                            ├─ Music gateway (CHKSZ_* env — see MUSIC-PROVIDERS.md)
                            ├─ Library (D1 or SQLite) + revision
                            └─ Charts / covers / lyrics helpers
```

## Auth

- Optional **Cloudflare Access** on private hostnames — [ACCESS.md](./ACCESS.md)  
- Optional **`MUSIC_ACCESS_TOKEN`** for `/api/library*`  
- Optional **`LIBRARY_READONLY`** demo mode (no writes / export)  
- Optional **`LIBRARY_TOKEN_REQUIRED_HOSTS`** fail-closed list  

## Library multi-device

- Meta key `revision` (monotone).  
- `PUT` / `DELETE` with client `revision` → mismatch **409** + current snapshot.  
- Bootstrap **unions** `localStorage` ∪ server by id (writable installs only).  
- List writes: upsert then delete stale rows (never wipe-then-insert).  

## Playback

- Prefer remote CDN URL; fail → force re-resolve → `/api/stream` **302** on Workers.  
- Qualities menu probes on demand.  
- Client resolve TTL + 429 backoff.  

## Free-tier CF policy

- No audio bodies on the edge; no R2/paid KV required.  
- Observability sampling on free tier only.  

## Import / export

| URL | Behavior |
|-----|----------|
| `GET /favs` | Favorites JSON download (**403** if read-only) |
| `GET/POST /import` | JSON by id or name lines; dedupe; (**403** if read-only) |

See [API.md](./API.md).
