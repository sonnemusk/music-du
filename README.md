# music-du

[English](./README.md) · [简体中文](./README.zh-CN.md)

[![CI](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml/badge.svg)](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

Open-source **personal music web app** — search, charts, likes, lyrics, many skins.

**Stack:** TypeScript · [Hono](https://hono.dev) · React + Zustand · **Cloudflare Workers + D1** or **Node + SQLite** (VPS / Fly / Docker).

| | |
|--|--|
| **Live demo** (read-only) | https://music.du.dev |
| **Self-host** (default) | Full writable install — [Deploy](#deploy) |

```text
SPA  ── /api/* ──►  Worker or Node
                      ├─ your music gateway
                      ├─ library (D1 / SQLite)
                      └─ charts · covers · lyrics
```

<details>
<summary>Table of contents</summary>

- [Screenshots](#screenshots) · [Features](#features) · [Quick start](#quick-start)
- [Deploy](#deploy) · [Environment](#environment) · [Docs](#docs)
- [API](#http-api) · [Demo mode](#optional-read-only-demo) · [Disclaimer](#disclaimer)

</details>

---

## Screenshots

Top-right: **language** (中文 / English) and **theme** (主题 · 一键切换).

<p align="center">
  <img src="docs/screenshots/skins-cycle.gif" alt="Cycling through skins" width="960" /><br/>
  <em>One-click skin switch</em>
</p>

<p align="center">
  <img src="docs/screenshots/search-ice.jpg" alt="Search" width="960" /><br/>
  <em>Search</em>
</p>

<p align="center">
  <img src="docs/screenshots/favorites-grape.jpg" alt="Liked songs" width="960" /><br/>
  <em>Liked · player + library</em>
</p>

<p align="center">
  <img src="docs/screenshots/lyrics-forest.jpg" alt="Lyrics" width="960" /><br/>
  <em>Lyrics · bilingual follow-scroll</em>
</p>

<p align="center">
  <img src="docs/screenshots/charts-sakura.jpg" alt="Charts" width="960" /><br/>
  <em>Charts · multi-platform boards</em>
</p>

---

## Features

- **Play** — CDN stream, list / single / shuffle, Media Session, quality pick  
- **Library** — queue · likes · history · multi-device revision lock  
- **Discover** — search · charts (rising / hot / new)  
- **Lyrics** — multi-source + cache + follow scroll  
- **Skins** — many themes × side / immersive / compact  
- **Import / export** — `/favs`, `/import`  
- **i18n** — default **中文**, switch to **English** in the header  
- **Shortcuts** — `Space` · `N` / `P` next/prev · more in-app  

---

## Quick start

```bash
git clone https://github.com/sonnemusk/music-du.git
cd music-du
cp .env.example .env   # set gateway URL / keys (server-only)
npm ci
npm run dev            # http://127.0.0.1:8787
```

Requires **Node.js ≥ 20**. Tests: `npm test && npm run typecheck`.

---

## Deploy

**Default = your own writable site.** You do not need the demo Worker to self-host.

Full guide: **[docs/DEPLOY.md](./docs/DEPLOY.md)**

| Target | Command |
|--------|---------|
| **Cloudflare** | `npm run setup:d1` → secrets → **`npm run deploy:cf`** |
| **Node VPS** | `npm run build && HOST=0.0.0.0 node dist/server/node.js` |
| **Fly.io** | volume + secrets → `fly deploy` ([fly.toml](./fly.toml)) |
| **Docker** | `docker build -t music-du .` · mount `/data` |
| **Vercel** | Not a full-stack drop-in — [notes](./docs/DEPLOY.md#4-vercel) |

### Cloudflare

```bash
npm run setup:d1
npx wrangler secret put MUSIC_ACCESS_TOKEN      # recommended if private
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS  # if your backup gateway needs keys
npm run deploy:cf                               # writable — not demo
```

Optional edge auth: [docs/ACCESS.md](./docs/ACCESS.md).

### Node / Docker

```bash
npm ci && npm run build
HOST=0.0.0.0 PORT=8787 NODE_ENV=production node dist/server/node.js

docker build -t music-du .
docker run -d -p 8787:8787 -v music-data:/data \
  -e MUSIC_ACCESS_TOKEN=… -e CHKSZ_FALLBACK_APIKEYS=… music-du
```

Persist `MUSIC_DATA_DIR` / the volume.

---

## Environment

See [`.env.example`](./.env.example). Never commit `.env`, `.dev.vars`, or `data/*`.

| Variable | Purpose |
|----------|---------|
| `CHKSZ_API_BASE` | Primary music gateway (server) |
| `CHKSZ_FALLBACK_*` | Backup gateway + keys (server only) |
| `MUSIC_ACCESS_TOKEN` | Protects `/api/library` when set |
| `VITE_MUSIC_ACCESS_TOKEN` | Optional SPA bake — avoid on public demos |
| `LIBRARY_READONLY` | Demo only — leave unset for your site |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node listen + SQLite path |

---

## Docs

| Doc | |
|-----|--|
| [docs/DEPLOY.md](./docs/DEPLOY.md) | CF · VPS · Fly · Docker · Vercel |
| [docs/API.md](./docs/API.md) | HTTP API |
| [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md) | Music APIs & copyright |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Design |
| [docs/README.md](./docs/README.md) | Index |
| [SECURITY.md](./SECURITY.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) | |

**Agents:** [DEPLOY §8](./docs/DEPLOY.md) → [API](./docs/API.md). Deploy the **writable** app unless asked for a read-only gallery.

---

## HTTP API

| | Path |
|--|------|
| Health / search / charts | `GET /api/health` · `/api/search` · `/api/charts…` |
| Play | `GET /api/song/:id` · `/api/stream/:id` · `/api/lyric/:id` |
| Library | `GET/PUT /api/library` · `DELETE /api/library/:list/:id` |
| Import / export | `GET /favs` · `GET/POST /import` |

Details: **[docs/API.md](./docs/API.md)**.

```text
client/   React SPA          server/   Hono (node.ts · worker.ts)
docs/     guides + screens   migrations/  D1 SQL
```

---

## Optional: read-only demo

Only if you want a **second**, public “listen only” site (like https://music.du.dev).

```bash
npm run deploy:cf:demo   # not the default self-host path
```

Set `LIBRARY_READONLY=true` on that Worker only. Likes / import / export stay disabled.

---

## Disclaimer

This is a **player + BFF**, not a licensed catalog. You must supply a **lawful** music API.  
Default env may use a community gateway for convenience — **you** own compliance.  
See [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md).

---

## License

[MIT](./LICENSE)
