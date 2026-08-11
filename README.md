# music-du

Open-source **personal music web app**: search, multi-platform charts, favorites/playlist/history, lyrics, many skins, keyboard shortcuts.

**Stack:** TypeScript · [Hono](https://hono.dev) BFF · React + Zustand · **Cloudflare Workers + D1** (production) or **Node + SQLite** (local / VPS / Fly).

```text
Browser SPA  ──same-origin /api/*──►  Worker or Node BFF
                                       ├─ your music gateway (env)
                                       ├─ library (D1 or SQLite)
                                       └─ charts / covers / lyrics helpers
```

Demo (read-only public share): configure a second Worker with `LIBRARY_READONLY=true`.

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
- Optional **read-only demo** mode for public links  

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
| `LIBRARY_READONLY` | Worker | `true` = demo: no writes / no export |
| `LIBRARY_TOKEN_REQUIRED_HOSTS` | Worker | Hosts that must have library token configured |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node | Listen address + SQLite directory |

**Never commit** `.env`, `.dev.vars`, or `data/*` libraries.

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Hono + Vite |
| `npm run build` | `dist/client` + `dist/server` |
| `npm run start:prod` | Node production server |
| `npm test` / `typecheck` | Vitest / `tsc` |
| `npm run smoke` | Local smoke (server up) |
| `npm run setup:d1` | Create free D1 database |
| `npm run deploy:cf` | Build + `wrangler deploy` |
| `npm run deploy:cf:demo` | Build + `wrangler deploy --env demo` |

---

## Deploy (short)

### Cloudflare Workers

```bash
npm run setup:d1          # paste database_id into wrangler.toml
npx wrangler secret put MUSIC_ACCESS_TOKEN
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS   # if needed
npm run deploy:cf
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

## Read-only demo mode

```toml
# wrangler env.demo
LIBRARY_READONLY = "true"
```

Visitors can listen and browse library; cannot favorite, import, or export. Skin/volume stay in **their** `localStorage`.

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
