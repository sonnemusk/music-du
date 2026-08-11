# music-du

[English](./README.md) · [简体中文](./README.zh-CN.md)

[![CI](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml/badge.svg)](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

Open-source **personal music web app** — search, charts, likes, lyrics, many skins.

TypeScript · [Hono](https://hono.dev) · React + Zustand · **Cloudflare Workers + D1** or **Node + SQLite**.

| | |
|--|--|
| **Demo** (read-only) | https://music.du.dev |
| **Self-host** | Writable install — start with [Quick start](#quick-start) |

```text
SPA ── /api/* ──► Worker / Node ──► your music gateway + library (D1 or SQLite)
```

---

## Screenshots

Top-right: **language** (中文 / English) and **theme** (主题 · 一键切换).

<p align="center">
  <img src="docs/screenshots/skins-cycle.gif" alt="One-click skin switch" width="960" /><br/>
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

- Playback — CDN stream, shuffle / repeat, quality, Media Session  
- Library — queue, likes, history, multi-device sync  
- Search & charts — rising / hot / new  
- Lyrics — multi-source, cached, follow-scroll  
- Skins — many themes × side / immersive / compact  
- Import / export — `/favs`, `/import`  
- **中文** UI by default; switch to **English** in the header  
- Shortcuts — `Space`, `N` / `P`, …

---

## Quick start

```bash
git clone https://github.com/sonnemusk/music-du.git && cd music-du
cp .env.example .env    # gateway URL / keys — server only
npm ci && npm run dev   # http://127.0.0.1:8787
```

Node **≥ 20**. Tests: `npm test && npm run typecheck`.

---

## Deploy

Self-host the **writable** app. You do **not** need the demo Worker.

| | |
|--|--|
| **Cloudflare** | `npm run setup:d1` → secrets → `npm run deploy:cf` |
| **Node** | `npm run build && HOST=0.0.0.0 node dist/server/node.js` |
| **Fly / Docker** | [fly.toml](./fly.toml) · [Dockerfile](./Dockerfile) |
| **Details** | **[docs/DEPLOY.md](./docs/DEPLOY.md)** |

```bash
# Cloudflare (most common)
npm run setup:d1
npx wrangler secret put MUSIC_ACCESS_TOKEN       # if you want a private library
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS   # if backup gateway needs keys
npm run deploy:cf
```

---

## Environment

[`.env.example`](./.env.example) — never commit secrets or `data/*`.

| Variable | Role |
|----------|------|
| `CHKSZ_API_BASE` / `CHKSZ_FALLBACK_*` | Music gateway (server only) |
| `MUSIC_ACCESS_TOKEN` | Protects library API |
| `LIBRARY_READONLY` | Demo only — leave unset for your site |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node |

---

## Docs & API

| | |
|--|--|
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Deploy CF / VPS / Fly / Docker |
| [docs/API.md](./docs/API.md) | HTTP API |
| [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md) | Music APIs & copyright |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Design |
| [SECURITY.md](./SECURITY.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) | |

```
GET  /api/health  /api/search  /api/charts/:platform
GET  /api/song/:id  /api/stream/:id  /api/lyric/:id
GET|PUT  /api/library    DELETE /api/library/:list/:id
GET  /favs    GET|POST /import
```

---

## Optional demo Worker

Public listen-only instance (same idea as https://music.du.dev):

```bash
npm run deploy:cf:demo   # LIBRARY_READONLY=true — not for normal self-host
```

---

## Disclaimer

Player + BFF only — **no licensed catalog**. You must use a lawful music API.  
See [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md).

## License

[MIT](./LICENSE)
