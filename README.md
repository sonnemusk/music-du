# Music

Personal music web app — search, charts, library, lyrics, multi-theme UI.  
Brand **Music** · npm package `kazam` · Cloudflare Worker **Music-Du** · domain **music.dubin.cc**.

**Stack:** TypeScript · Hono BFF · React + Zustand · Node **or** Cloudflare Workers (free tier first).

Upstream: [ChKSz](https://api.chksz.top)-compatible gateway (`CHKSZ_API_BASE`). API keys stay on the server.

---

## Features

- **Play**: CDN direct URL preferred; progressive streaming (not full-download-before-play)
- **Library**: playlist · favorites · history (SQLite on Node; optional free **D1** on CF; browser `localStorage` fallback)
- **Search** + multi-platform **charts** (Douyin / NetEase / QQ / Kugou / Kuwo / … · soar/hot/new)
- **Lyrics**: multi-source resolve, local cache, center-follow scroll
- **Skins**: many visual themes × layout structures (dock / side / immersive / compact / …)
- **Performance**
  - Background **URL pre-resolve** for search, charts, favorites, playlist, history
  - Next-track warm (resolve + media buffer; optional IDB for favorites)
  - Cover / chart / lyric caches (browser + server disk or CF Cache API)
- **Shortcuts**: Space play/pause · ←/→ seek · [/] prev/next · M mute · F favorite · L mode · Esc close theme panel

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design.

---

## Requirements

- **Node.js ≥ 20**
- Optional: Cloudflare account + `wrangler` for Workers deploy

---

## Quick start (local)

```bash
cp .env.example .env
# Edit .env — set CHKSZ_APIKEY if your gateway needs it

npm install
npm run dev          # http://127.0.0.1:8787  (API + Vite HMR)
```

Production build on the same machine:

```bash
npm run build
NODE_ENV=production npm run start:prod   # serves dist/client + dist/server
# or: npm start   # tsx production without precompile
```

---

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `CHKSZ_APIKEY` | _(empty)_ | Upstream API key (server only) |
| `CHKSZ_API_BASE` | `https://api.chksz.top` | Gateway base URL |
| `HOST` / `PORT` | `127.0.0.1` / `8787` | Node listen address |
| `MUSIC_DATA_DIR` | `./data` | SQLite + chart/cover disk cache |

Template: [`.env.example`](./.env.example). **Never commit `.env`.**

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run build` | Vite client + `tsc` server → `dist/` |
| `npm start` | Production via `tsx` |
| `npm run start:prod` | Production via compiled `dist/server/node.js` |
| `npm test` | Vitest unit/API tests |
| `npm run typecheck` | Client + server TypeScript |
| `npm run smoke` | Live HTTP smoke (server must be up) |
| `npm run setup:d1` | Create free D1 + print wrangler snippet |
| `npm run deploy:cf` | `build` + `wrangler deploy` |

---

## Project layout

```
music-app/
├── client/                 # React SPA (Vite)
│   ├── public/             # Favicons, PWA manifest
│   └── src/
│       ├── components/     # Transport, lyrics, lists, …
│       ├── lib/            # API client, caches, prefetch
│       ├── skins/          # Themes + layout shells
│       └── store/          # Zustand player
├── server/                 # Hono BFF
│   ├── node.ts             # VPS / local entry
│   ├── worker.ts           # Cloudflare Workers entry
│   ├── charts.ts           # Charts (memory; disk via charts-disk)
│   ├── charts-disk.ts      # Node-only disk chart cache
│   └── …
├── migrations/             # D1 SQL (optional CF)
├── scripts/                # smoke, setup-d1
├── tests/                  # Vitest
├── docs/                   # Architecture notes
├── data/                   # Runtime only (gitignored contents)
├── wrangler.toml           # CF Workers config
└── package.json
```

---

## Deploy — Node VPS

Example (Caddy reverse proxy → `127.0.0.1:8787`):

```bash
rsync -az --delete \
  --exclude node_modules --exclude data --exclude .env --exclude dist --exclude .git \
  ./ user@host:/path/to/music-app/

ssh user@host 'cd /path/to/music-app && npm install --legacy-peer-deps && npm run build && sudo systemctl restart music-app'
```

systemd should run:

```text
ExecStart=/usr/bin/node /path/to/music-app/dist/server/node.js
WorkingDirectory=/path/to/music-app
Environment=NODE_ENV=production
# EnvironmentFile=/path/to/music-app/.env
```

Preserve `data/` across deploys (library DB + caches).

---

## Deploy — Cloudflare Workers (free tier)

**GitHub:** private repo [sonnemusk/Music-Du](https://github.com/sonnemusk/Music-Du)  
**Worker:** `Music-Du` · **D1:** `Music-Du-Library` · **Domain:** https://music.dubin.cc  

Push to `main` → GitHub Actions (`.github/workflows/deploy.yml`) runs `npm run build` + `wrangler deploy`.  
Same secrets as other `*-du` projects:

| Secret | Notes |
|--------|--------|
| `CLOUDFLARE_API_TOKEN` | Reuse the same account token as shortener-du / nav-du / … |
| `CLOUDFLARE_ACCOUNT_ID` | `6a243c6fffe95b2a146eca678f50b001` |

Worker secret (once, not in GitHub):

```bash
npx wrangler secret put CHKSZ_APIKEY   # upstream gateway key
```

**Policy (hard rules):**

| Topic | Rule |
|-------|------|
| Paid products | Not required / not used (no R2, paid KV, Image Resizing) |
| Audio | Play **resolved remote URL**; `/api/stream` **302 only** — no audio body cache |
| Covers / charts / lyrics / song **metadata** | Free **Workers Cache API** |
| Library | Free **D1** **Music-Du-Library** (`MUSIC_DU_DB`); else browser `localStorage` |
| Naming | All CF resources prefixed **Music-Du-*** |

Manual deploy:

```bash
npm run build && npx wrangler deploy
```

Details: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), `wrangler.toml`.

---

## Caching & playback (short)

1. **List appears** → background pre-resolve top N track URLs into browser durable cache  
2. **Click play** → use cached URL if present (no `/api/song` wait)  
3. **Play error** (expired CDN) → invalidate → resolve once → stream/redirect fallback  
4. **Next track** → sticky prediction + prefetch while current song plays  

Audio is **streamed** by the browser; full-file IDB cache is only an optional speedup for favorites.

---

## Testing

```bash
npm test
npm run typecheck

# With server running:
npm run smoke
```

---

## License / usage

Personal project. Upstream music APIs and content rights remain your responsibility; use only with accounts/gateways you are allowed to use.

---

## Changelog notes for maintainers

- v2: Full TypeScript rewrite (Hono + React); Python prototype removed from tree  
- Multi-layout skins, charts, resolve prefetch, CF free-tier worker path  
