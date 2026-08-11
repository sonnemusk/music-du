# music-du

[English](./README.md) · [简体中文](./README.zh-CN.md)

[![CI](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml/badge.svg)](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

Open-source **personal music web app** — search, charts, favorites, lyrics, many skins.

**Stack:** TypeScript · [Hono](https://hono.dev) BFF · React + Zustand · **Cloudflare Workers + D1** or **Node + SQLite** (VPS / Fly / Docker).

| | |
|--|--|
| **Live demo** (read-only) | https://music.du.dev — listen & browse; cannot edit favorites |
| **Your install** (default) | Writable site via `npm run deploy:cf` / Node / Fly — see [Deploy](#deploy-your-site--default) |

> Self-hosting always means the **normal writable app**. Demo mode is optional showcase only.

```text
Browser SPA  ──same-origin /api/*──►  Worker or Node BFF
                                       ├─ your music gateway (env)
                                       ├─ library (D1 or SQLite)
                                       └─ charts · covers · lyrics
```

<details>
<summary><strong>Table of contents</strong></summary>

- [Screenshots](#screenshots)
- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start-local)
- [Deploy](#deploy-your-site--default)
- [Environment](#environment)
- [Documentation](#documentation)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [HTTP API](#http-api-index)
- [Optional demo](#optional-read-only-demo)
- [Disclaimer](#disclaimer)
- [Contributing](#contributing)
- [License](#license)

</details>

---

## Screenshots

Every asset below is shown at **the same width (960px)** so the gallery is aligned and easy to compare.

### 1. Skin switch (animated GIF)

- **What:** click top-right **主题 · …** or **一键切换** to cycle themes  
- **File:** `docs/screenshots/skins-cycle.gif`  
- **Quality:** **1280×800** source, **1s per skin**, palette without dither (sharper UI text)

<p align="center">
  <img src="docs/screenshots/skins-cycle.gif" alt="GIF: one-click skin switch across themes" width="960" />
</p>

<p align="center"><b>One-click skin switch</b></p>

### 2. Main UI (static, identical size)

Sources are **1440×900** JPEG; README display width **960px** for all three.

<p align="center">
  <img src="docs/screenshots/favorites-grape.jpg" alt="Favorites tab — Grape skin" width="960" /><br/>
  <b>Favorites (喜欢)</b> — library + player · skin「葡萄」
</p>

<p align="center">
  <img src="docs/screenshots/lyrics-forest.jpg" alt="Lyrics tab — Forest skin" width="960" /><br/>
  <b>Lyrics (歌词)</b> — bilingual follow-scroll · skin「密林」
</p>

<p align="center">
  <img src="docs/screenshots/charts-sakura.jpg" alt="Charts tab — Sakura skin" width="960" /><br/>
  <b>Charts (热榜)</b> — multi-platform boards · skin「墨红花」
</p>

---

## Features

- **Play** — direct CDN URL, list / single / shuffle, Media Session, quality pick  
- **Library** — playlist · favorites · history · multi-device `revision` lock  
- **Discover** — keyword search · multi-platform charts (soar / hot / new)  
- **Lyrics** — multi-source resolve + local cache + follow scroll  
- **Skins** — many themes × side / immersive / compact layouts  
- **Import / export** — `/favs` JSON, `/import` (id or name list)  
- **Shortcuts** — `Space` play/pause · `N` / `P` next/prev · more in-app  
- **i18n** — UI default **中文**, switch to **English** via header `EN` / `中文` (stored in `localStorage`)  

Details: [docs/FEATURES.md](./docs/FEATURES.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Requirements

- **Node.js ≥ 20**
- Optional: Cloudflare account + [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for Workers  
- A music **gateway you are allowed to use** (see [Disclaimer](#disclaimer))

---

## Quick start (local)

```bash
git clone https://github.com/sonnemusk/music-du.git
cd music-du
cp .env.example .env
# Edit .env — gateway base URL / keys (server-only). See .env.example comments.

npm ci
npm run dev          # http://127.0.0.1:8787
```

```bash
npm test && npm run typecheck
npm run build && npm run start:prod
```

---

## Deploy (your site — default)

Full guide: **[docs/DEPLOY.md](./docs/DEPLOY.md)** · index: **[docs/README.md](./docs/README.md)**

| Target | One-liner |
|--------|-----------|
| **Cloudflare** | `npm run setup:d1` → secrets → **`npm run deploy:cf`** |
| **Node VPS** | `npm run build && HOST=0.0.0.0 node dist/server/node.js` |
| **Fly.io** | `fly launch` + volume + secrets → `fly deploy` |
| **Docker** | `docker build -t music-du .` + volume `/data` |
| **Vercel** | Not full-stack drop-in — [why](./docs/DEPLOY.md#4-vercel) |
| **Demo read-only** | Optional `npm run deploy:cf:demo` — **not** for normal self-host |

### Cloudflare (most common)

```bash
npm run setup:d1                              # paste database_id into wrangler.toml
npx wrangler secret put MUSIC_ACCESS_TOKEN    # recommended for private installs
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS  # if backup gateway needs keys
npm run deploy:cf                             # writable install — not demo
```

Bind a custom domain in the Cloudflare dashboard. Optional: [Access](./docs/ACCESS.md).

### Node / Docker

```bash
# bare metal
npm ci && npm run build
HOST=0.0.0.0 PORT=8787 NODE_ENV=production node dist/server/node.js

# Docker
docker build -t music-du .
docker run -d -p 8787:8787 -v music-data:/data \
  -e MUSIC_ACCESS_TOKEN=… -e CHKSZ_FALLBACK_APIKEYS=… music-du
```

Persist `MUSIC_DATA_DIR` / the volume (SQLite + caches).

### Fly.io

```bash
fly launch --no-deploy
fly volumes create music_data --size 1
fly secrets set MUSIC_ACCESS_TOKEN=… CHKSZ_FALLBACK_APIKEYS=…
fly deploy
```

See [`Dockerfile`](./Dockerfile) · [`fly.toml`](./fly.toml).

---

## Environment

Copy [`.env.example`](./.env.example). **Never commit** `.env`, `.dev.vars`, or `data/*`.

| Variable | Where | Purpose |
|----------|--------|---------|
| `CHKSZ_API_BASE` | Server | Primary music gateway base URL |
| `CHKSZ_FALLBACK_BASE` / `CHKSZ_FALLBACK_APIKEYS` | Server | Backup host + keys (**never** in the browser) |
| `MUSIC_ACCESS_TOKEN` | Server | Protects `/api/library` when set |
| `VITE_MUSIC_ACCESS_TOKEN` | Build (optional) | SPA default token — avoid on public demos |
| `LIBRARY_READONLY` | Worker **demo only** | Leave **unset** for your site |
| `LIBRARY_TOKEN_REQUIRED_HOSTS` | Worker | Hosts that must have library token set |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node | Listen address + SQLite directory |

---

## Documentation

| Doc | Contents |
|-----|----------|
| **[docs/README.md](./docs/README.md)** | Doc index |
| **[docs/DEPLOY.md](./docs/DEPLOY.md)** | CF · VPS · Fly · Docker · Vercel |
| **[docs/API.md](./docs/API.md)** | Full HTTP API |
| **[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)** | Music APIs, copyright, plug-in |
| **[docs/ACCESS.md](./docs/ACCESS.md)** | Cloudflare Access + library token |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | Runtime design |
| **[SECURITY.md](./SECURITY.md)** | Secrets & reporting |

**Agents:** [docs/DEPLOY.md §8](./docs/DEPLOY.md) → [docs/API.md](./docs/API.md). Deploy the **writable** app unless the user asked for a read-only gallery.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Hono + Vite |
| `npm run build` | `dist/client` + `dist/server` |
| `npm run start:prod` | Node production (**your** site) |
| `npm test` / `typecheck` | Vitest / TypeScript |
| `npm run smoke` | HTTP smoke against a running server |
| `npm run setup:d1` | Create free D1 |
| `npm run deploy:cf` | **Default** CF deploy (writable) |
| `npm run deploy:cf:demo` | Optional read-only second Worker |

---

## Project layout

```text
client/       React SPA (Vite)
server/       Hono BFF — node.ts · worker.ts
docs/         Deploy, API, providers, screenshots
migrations/   D1 SQL
scripts/      smoke, D1 setup
tests/        Vitest
data/         Runtime only (gitignored)
```

---

## HTTP API (index)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/health` | Flags, `readOnly` |
| GET | `/api/search` | `?q=` |
| GET | `/api/charts` · `/api/charts/:platform` | soar / hot / new |
| GET | `/api/song/:sid` | Resolve stream URL |
| GET | `/api/song/:sid/qualities` | Quality ladder |
| GET | `/api/stream/:sid` | CF: **302** to CDN |
| GET | `/api/lyric/:sid` | Lyrics |
| GET | `/api/cover-proxy` | Cover proxy |
| GET/PUT | `/api/library` | Token when configured |
| DELETE | `/api/library/:listType/:sid` | playlist / favorites / history |
| GET | `/favs` · `/export` | Favorites JSON |
| GET/POST | `/import` | Merge by id or name list |

Full reference: **[docs/API.md](./docs/API.md)**.

---

## Optional: read-only demo

Skip this for a normal personal install.

Public showcase (listen only): **https://music.du.dev**

To run your **own** second Worker the same way:

```bash
npm run deploy:cf:demo    # wrangler --env demo
```

```toml
# [env.demo] only — never on the default Worker
LIBRARY_READONLY = "true"
```

| | Your site (default) | Demo (optional) |
|--|--|--|
| Command | `deploy:cf` / Node / Fly | `deploy:cf:demo` only |
| Library | Read **and write** | Read-only |
| `LIBRARY_READONLY` | Unset | `true` |
| Example | your domain | https://music.du.dev |

---

## Disclaimer

This repo is a **player + BFF**. It does **not** ship a licensed music catalog.

- You must use a **lawful** API / content source.  
- Default env may point at a community NetEase-compatible gateway for convenience; **availability and legality are yours**.  
- Plug in your own API: **[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)**.

---

## Contributing

- Keep gateway keys **server-side** only  
- `npm test && npm run typecheck` before PR  
- Do not commit `.env`, personal libraries, or real secrets  

---

## License

[MIT](./LICENSE)
