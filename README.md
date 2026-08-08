# Music

Personal music web app — search, charts, library, lyrics, multi-theme UI.  
Brand **Music** · npm package `kazam` · GitHub / Cloudflare Worker **music-du** · domain **music.dubin.cc**.

**Stack:** TypeScript · Hono BFF · React + Zustand · Node **or** Cloudflare Workers (free tier first).

Upstream music gateway is configured only on the **server** (env / Worker secrets). Never put gateway keys in the client or in git.

---

## Features

- **Play**: CDN direct URL preferred; progressive streaming
- **Library**: playlist · favorites · history (SQLite on Node; free **D1** `music-du-library` on CF; browser `localStorage` fallback)
- **Search** + multi-platform **charts** (Douyin / NetEase / QQ / Kugou / Kuwo / … · soar/hot/new)
- **Lyrics**: multi-source resolve, local cache, center-follow scroll
- **Skins**: many visual themes × layout structures
- **Performance**: list URL pre-resolve, next-track warm, cover/chart/lyric caches
- **Shortcuts**: Space · ←/→ seek · [/] prev/next · M mute · F favorite · L mode · Esc theme panel

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Requirements

- **Node.js ≥ 20**
- Optional: Cloudflare account + `wrangler` for Workers deploy

---

## Quick start (local)

```bash
cp .env.example .env
# Fill server-side env vars locally (see .env.example). Do not commit .env.

npm install
npm run dev          # http://127.0.0.1:8787
```

Production on the same machine:

```bash
npm run build
NODE_ENV=production npm run start:prod
```

---

## Environment

Copy [`.env.example`](./.env.example). Variable **names** (not values) include:

| Variable | Purpose |
|----------|---------|
| `MUSIC_ACCESS_TOKEN` | Protects `/api/library` only (Worker secret) |
| `VITE_MUSIC_ACCESS_TOKEN` | SPA `X-Music-Token` for library sync |
| `CHKSZ_API_BASE` | Free primary gateway (default `api.chksz.top`, no key) |
| `CHKSZ_FALLBACK_*` | Paid `.com` backup + keys |
| `HOST` / `PORT` | Node listen address |
| `MUSIC_DATA_DIR` | SQLite + disk caches (Node) |

**Never commit** `.env`, tokens, or real keys. Production secrets live in the host env, Cloudflare Worker secrets, or GitHub Actions secrets (`MUSIC_ACCESS_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

**Access:** whole site (`music.dubin.cc` / `.one` / `.vip`) is behind free **Cloudflare Access** (email login).  
**Export:** `/favs` · **Import:** `/import`（`/favs` JSON **或** 歌名/歌名+作者 文本；搜索匹配；**按 id 去重**；成功跳转首页）.  
**Library multi-device:** D1 `revision` optimistic lock (409 on conflict).  
Details: [docs/ACCESS.md](./docs/ACCESS.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local development |
| `npm run build` | Client + server → `dist/` |
| `npm start` / `start:prod` | Production server |
| `npm test` / `typecheck` | Tests / TypeScript |
| `npm run smoke` | Live HTTP smoke (server up) |
| `npm run setup:d1` | Create free D1 `music-du-library` |
| `npm run deploy:cf` | `build` + `wrangler deploy` |

---

## Project layout

```
client/     React SPA
server/     Hono BFF (node.ts + worker.ts)
tests/      Vitest
scripts/    smoke, setup-d1
migrations/ D1 SQL
docs/       architecture / features
data/       runtime only (gitignored)
```

---

## Deploy — Node VPS

```bash
rsync -az --delete \
  --exclude node_modules --exclude data --exclude .env --exclude dist --exclude .git \
  ./ user@host:/path/to/music-du/

ssh user@host 'cd /path/to/music-du && npm install --legacy-peer-deps && npm run build && sudo systemctl restart music-app'
```

Point reverse proxy at the Node port; keep `data/` across deploys; load env from a file **outside** git.

---

## Deploy — Cloudflare (`music-du`)

| Resource | Name |
|----------|------|
| GitHub | `sonnemusk/music-du` (private) |
| Worker | `music-du` |
| D1 | `music-du-library` |
| Domain | `music.dubin.cc` |

Push to `main` → [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds and deploys.

**GitHub Actions secrets** (set in repo settings — do not put values in this README):

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Same token/account as your other `*-du` Workers is fine if permissions allow.

**Worker secrets** (Cloudflare dashboard or `wrangler secret put`, once):

- Upstream gateway key, if required

**Policy:** free tier only; audio plays from resolved remote URLs; no audio body on CF; no paid KV/R2 required.

Manual: `npm run build && npx wrangler deploy`

---

## Caching & playback (short)

1. List ready → background pre-resolve URLs into browser cache  
2. Click play → use cache; re-resolve only on miss / play error  
3. Next track → sticky prediction + prefetch  

---

## Testing

```bash
npm test && npm run typecheck
# server running:
npm run smoke
```

---

## License / usage

Personal project. Upstream music APIs and content rights remain your responsibility.
