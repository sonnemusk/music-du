# Architecture

## Overview

**Music** (package name `kazam`) is a personal music web app:

- **Browser**: React + Zustand SPA, multi-layout skins, shared hidden `<audio>`
- **BFF**: Hono API (`/api/*`) — never puts ChKSz secrets in the client
- **Upstream**: ChKSz / NetEase-compatible gateway (`CHKSZ_API_BASE`)
- **Runtimes**:
  - **Node** (`server/node.ts`) — VPS / local, SQLite library, disk chart/cover cache
  - **Cloudflare Workers** (`server/worker.ts`) — free tier first; optional D1 library

```
┌─────────────────────────────────────────────────────────┐
│  React SPA  ·  skins / player store  ·  local caches    │
│  (resolve LS, lyrics LS, covers Cache Storage, IDB)     │
└───────────────────────────┬─────────────────────────────┘
                            │ same-origin /api/*
┌───────────────────────────▼─────────────────────────────┐
│  Hono BFF                                               │
│  search · song resolve · stream · lyric · charts · lib  │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
         Node VPS                    CF Worker
     SQLite + disk              Cache API + opt. D1
                │                         │
                └──────────┬──────────────┘
                           ▼
                   api.chksz.top (etc.)
```

## Client principles

| Concern | Approach |
|---------|----------|
| Play URL | Prefer **pre-resolved CDN URL** from durable cache; re-resolve only on miss / play error |
| Prefetch | Search / charts / favorites / playlist / history resolve warm in background |
| Next track | Sticky predicted next + `prefetchAround` (resolve + media warm + optional IDB blob) |
| Audio bytes on CF | **Never** edge-cache; Worker `/api/stream` is **302** to remote only |
| Library | Server SQLite/D1 when available; always also **localStorage** fallback |

## Server modules (`server/`)

| File | Role |
|------|------|
| `app.ts` | Node Hono routes |
| `node.ts` | HTTP entry, Vite/static, attaches disk chart cache |
| `worker.ts` | Cloudflare Worker entry + free Cache API policy |
| `chksz.ts` | Upstream search / fetchMusic |
| `play.ts` | Resolve play URL, choose remote vs stream |
| `charts.ts` | Multi-platform charts (memory + optional disk) |
| `charts-disk.ts` | **Node only** — `data/charts` JSON |
| `cover-cache.ts` | **Node only** — `data/covers` |
| `edge-cache.ts` | Workers Cache API helpers (meta/covers only) |
| `library.ts` | SQLite library |
| `lyrics.ts` | Multi-source lyrics |
| `config.ts` | Env / paths (Node) |

## API surface

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Runtime, apikey presence, CF policy flags |
| GET | `/api/search?q=` | Search tracks |
| GET | `/api/song/:id` | Resolve play metadata + CDN url |
| GET | `/api/stream/:id` | Node: proxy; CF: **302** to remote |
| GET | `/api/lyric/:id` | Lyrics (+ optional name/artist) |
| GET | `/api/charts` | Platforms + boards |
| GET | `/api/charts/:platform?board=` | Chart tracks |
| GET/PUT | `/api/library` | Playlist / favorites / history |
| DELETE | `/api/library/:list/:id` | Remove one item |
| GET | `/api/cover-proxy?url=` | Same-origin cover proxy |

## Cloudflare free-tier policy

- **Allowed**: Workers, Assets, Cache API, optional D1 free tier, secrets
- **Not used**: R2, paid KV, Image Resizing, audio body cache/proxy
- **Audio**: browser plays remote URL from resolve; stream is redirect-only on CF

## Cloudflare resource naming (music-du)

Use **lowercase kebab-case**, same style as `shortener-du` / `nav-du` / `ios-loc-du`:

| Resource | Name in Cloudflare / GitHub | Notes |
|----------|-------------------------------|--------|
| GitHub repo | `music-du` | private |
| Worker | `music-du` | `wrangler.toml` `name` |
| D1 | `music-du-library` | favorites / playlist / history |
| Binding | `MUSIC_DU_DB` | env binding in Worker code |
| Custom domain | `music.dubin.cc` | routes in `wrangler.toml` |
| KV | *(none)* | not used |

Do not put API tokens, account IDs, or gateway keys in docs or commits. Use GitHub Actions secrets / `wrangler secret` / local `.env` only.

## Data directories (Node)

```
data/
  library.db          # SQLite (gitignored)
  charts/*.json       # chart disk cache
  covers/*            # cover disk cache
```

## Related docs

- Root [README.md](../README.md) — setup, deploy, scripts
- [wrangler.toml](../wrangler.toml) — CF binding comments
