# music-du

Open-source **personal music web app**: search, multi-platform charts, favorites/playlist/history, lyrics, many skins, keyboard shortcuts.

**Stack:** TypeScript · [Hono](https://hono.dev) BFF · React + Zustand · **Cloudflare Workers + D1** (production) or **Node + SQLite** (local / VPS / Fly).

```text
Browser SPA  ──same-origin /api/*──►  Worker or Node BFF
                                       ├─ your music gateway (env)
                                       ├─ library (D1 or SQLite)
                                       └─ charts / covers / lyrics helpers
```

### Default deploy = **your** full site (not the demo)

When you follow this README / `docs/DEPLOY.md`, you deploy a **normal, writable personal install**:

- You own the library (favorites / playlist / history can be changed)
- Commands: `npm run deploy:cf` · `npm run start:prod` · Fly `fly deploy` · Docker, etc.
- **Do not** set `LIBRARY_READONLY=true` unless you intentionally want a public showcase

The **demo (read-only)** mode is **optional** and only for sharing a look-only instance (e.g. “visitors can listen, cannot edit my favorites”). It is **not** the default, and you **do not need it** for self-hosting.

| | Your site (default) | Demo (optional) |
|--|--|--|
| Command | `npm run deploy:cf` / Node / Fly | `npm run deploy:cf:demo` only |
| Library | Read **and write** | Read-only |
| Env | (no `LIBRARY_READONLY`) | `LIBRARY_READONLY=true` |
| Who needs it | **Everyone self-hosting** | Only if you want a public gallery |

---

## Disclaimer (read this)

This repository is a **player + integration layer**. It does **not** include licensed music.

- You must supply a **lawful** music/metadata/stream API (or self-host one you are allowed to use).  
- Default env points at a **community NetEase-compatible gateway** for convenience; availability and legality are **your** responsibility.  
- See **[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)** for options and how to plug in your own API.

MIT licensed — see [LICENSE](./LICENSE). No warranty.

---

## Features

- Playback: direct CDN URL preferred; list / single / shuffle; Media Session  
- Library: playlist · favorites · history · multi-device `revision` lock  
- Search + charts (soar / hot / new across several platforms)  
- Lyrics with local cache  
- Many visual themes (side / immersive / compact layouts)  
- Import/export favorites (`/favs`, `/import`)  
- Optional read-only **demo** mode (showcase only — skip for your own deploy)  

More: [docs/FEATURES.md](./docs/FEATURES.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## Quick start (local)

```bash
git clone https://github.com/sonnemusk/music-du.git
cd music-du
cp .env.example .env
# Edit .env — at least leave free primary base; add keys if you use a paid fallback

npm ci
npm run dev          # http://127.0.0.1:8787
```

```bash
npm test && npm run typecheck
npm run build && npm run start:prod
```

---

## Documentation map

| Doc | Contents |
|-----|----------|
| **[docs/DEPLOY.md](./docs/DEPLOY.md)** | Cloudflare · Node VPS · **Fly.io** · **Vercel** notes · Docker |
| **[docs/API.md](./docs/API.md)** | Full HTTP API reference |
| **[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)** | Music APIs, copyright, plug-in guide |
| **[docs/ACCESS.md](./docs/ACCESS.md)** | Optional Cloudflare Access + library token |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | Runtime design |
| **[SECURITY.md](./SECURITY.md)** | Secrets & reporting |

**Agents / automation:** start with `docs/DEPLOY.md` §8 checklist, then `docs/API.md`.

---

## Environment (names only)

Copy [`.env.example`](./.env.example). Important variables:

| Variable | Where | Purpose |
|----------|--------|---------|
| `CHKSZ_API_BASE` | Server | Primary music gateway base URL |
| `CHKSZ_FALLBACK_BASE` / `CHKSZ_FALLBACK_APIKEYS` | Server | Backup host + keys (never expose to browser) |
| `MUSIC_ACCESS_TOKEN` | Server | Protects `/api/library` when set |
| `VITE_MUSIC_ACCESS_TOKEN` | Build (optional) | SPA default `X-Music-Token` — avoid on public demos |
| `LIBRARY_READONLY` | Worker **demo only** | Leave **unset** for your own site. `true` = showcase, no writes / no export |
| `LIBRARY_TOKEN_REQUIRED_HOSTS` | Worker | Hosts that must have library token configured |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node | Listen address + SQLite directory |

**Never commit** `.env`, `.dev.vars`, or `data/*` libraries.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Hono + Vite |
| `npm run build` | `dist/client` + `dist/server` |
| `npm run start:prod` | Node production server (**your** site) |
| `npm test` / `typecheck` | Vitest / `tsc` |
| `npm run smoke` | Local smoke (server up) |
| `npm run setup:d1` | Create free D1 database |
| `npm run deploy:cf` | **Default CF deploy** — your writable Worker |
| `npm run deploy:cf:demo` | Optional second Worker — read-only showcase only |

---

## Deploy (short)

Self-hosters only need the **default** path below. Skip anything labeled “demo”.

### Cloudflare Workers (your site)

```bash
npm run setup:d1          # paste database_id into wrangler.toml
npx wrangler secret put MUSIC_ACCESS_TOKEN
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS   # if needed
npm run deploy:cf         # ← this is YOUR install (writable). Not demo.
```

Full steps: [docs/DEPLOY.md §1](./docs/DEPLOY.md).

### Node VPS

```bash
npm ci && npm run build
HOST=0.0.0.0 PORT=8787 NODE_ENV=production node dist/server/node.js
```

Put TLS reverse proxy in front; persist `MUSIC_DATA_DIR`.

### Fly.io

```bash
fly launch --no-deploy
fly volumes create music_data --size 1
fly secrets set MUSIC_ACCESS_TOKEN=… CHKSZ_FALLBACK_APIKEYS=…
fly deploy
```

See [`Dockerfile`](./Dockerfile) · [`fly.toml`](./fly.toml) · [docs/DEPLOY.md §3](./docs/DEPLOY.md).

### Vercel

**Not a drop-in full-stack target** (no durable SQLite/D1 on serverless as used here).  
Use Vercel for static SPA only + API on Workers/Fly/VPS, or pick another host. Details: [docs/DEPLOY.md §4](./docs/DEPLOY.md).

---

## Project layout

```text
client/       React SPA (Vite)
server/       Hono BFF — node.ts (VPS) · worker.ts (Cloudflare)
docs/         Deploy, API, providers, architecture
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
| GET | `/api/charts` · `/api/charts/:platform` | Boards soar/hot/new |
| GET | `/api/song/:sid` | Resolve stream URL |
| GET | `/api/song/:sid/qualities` | Quality ladder |
| GET | `/api/stream/:sid` | CF: **302** to CDN |
| GET | `/api/lyric/:sid` | Lyrics |
| GET | `/api/cover-proxy` | Cover proxy |
| GET/PUT | `/api/library` | Token when configured |
| DELETE | `/api/library/:listType/:sid` | playlist/favorites/history |
| GET | `/favs` · `/export` | Favorites JSON download |
| GET/POST | `/import` | Merge favorites / name list |

Full reference: **[docs/API.md](./docs/API.md)**.

---

## Read-only demo mode (optional showcase only)

**You can ignore this entire section** if you only want your own music site.

Demo is for a **second**, public “look but don’t touch” deployment (maintainer gallery, screenshots, etc.). Default `npm run deploy:cf` / Node / Fly **do not** enable it.

```bash
# Only if you deliberately want a public read-only mirror:
npm run deploy:cf:demo
```

```toml
# wrangler [env.demo] only — do NOT put this on your main Worker
LIBRARY_READONLY = "true"
```

Effects: listen + browse library OK; favorite / import / export blocked. Skin/volume stay in the visitor’s `localStorage`.

---

## Security hygiene before you go public

1. Repo → **Settings → General → Change repository visibility** only after this list  
2. Confirm `.env` / `.dev.vars` / `data/*` dumps are **not** in git (`git status`, `git log --all -- data/`)  
3. Rotate any keys that ever sat in chat logs or old commits  
4. Demo Worker: **no** `MUSIC_ACCESS_TOKEN`, **no** Access on public hostname  
5. Private Worker: Access + library token  

See [SECURITY.md](./SECURITY.md).

---

## Contributing

Issues and PRs welcome. Please:

- Keep gateway keys server-side  
- Run `npm test && npm run typecheck`  
- Avoid committing personal libraries or real hostnames/secrets in samples  

---

## License

[MIT](./LICENSE)
