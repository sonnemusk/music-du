# Architecture

Personal music SPA on **Cloudflare Workers free tier** (no R2 / paid KV / paid Access extras).

## Runtime

| Layer | Role |
|-------|------|
| **Browser** | React + Zustand; resolve/lyric caches; optional IDB audio **only when stream proxies bytes** (Node). On CF, stream is 302 → no blob cache. |
| **Worker** (`server/worker.ts`) | Production BFF: search, song, lyric, charts, library D1, cover Cache API, `/favs` export. |
| **Node** (`server/node.ts` + `app.ts`) | **Local / VPS dev only** — SQLite library, disk charts/covers, can byte-proxy stream. Not the primary production path. |

```
SPA ──same-origin /api/*──► Worker (CF Access at edge)
                              ├─ ChKSz .top (free, no key)
                              ├─ ChKSz .com (keys RR, fallback)
                              ├─ D1 music-du-library (lists + resolve_cache + revision)
                              └─ Cache API (charts/meta/covers only — never audio)
```

## Auth (free)

- **Cloudflare Access** on `music.dubin.cc` / `.one` / `.vip` (whole site) — email OTP.
- **Service Token** for CI smoke (`CF-Access-Client-Id/Secret`).
- **`MUSIC_ACCESS_TOKEN`** only for `/api/library` (SPA `X-Music-Token`).
- `/favs` `/export`: Access only (no app token).

## Library multi-device

- D1 `library_meta.revision` monotone counter.
- `PUT/DELETE` with client `revision` → mismatch **409** + current data.
- Client applies 409 payload and toasts; bootstrap **unions** localStorage ∪ D1 by id (D1 order first).
- List writes: upsert then delete stale (never DELETE-all first).

## Playback

- Prefer remote CDN URL; fail → `force=1` re-resolve → `/api/stream` 302.
- Qualities menu probes on open only (not every play).
- Client resolve TTL 6m memory / 12m durable.
- Prefetch backs off on 429/5xx (client-side).

## Skins

- Layouts: `side` | `immersive` | `compact` only.
- Theme catalog pruned (~50); default `aurora`.

## Free-tier policy

- No audio bodies on CF; no R2/paid KV; Observability sampling free-tier only.
- `workers_dev = false` (custom hosts + Access only).
