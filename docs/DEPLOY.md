# Deploy guide

## Default = your own writable site (not demo)

**Self-hosting users should deploy the normal app**, not the demo.

| | **Your install (default)** | Demo (optional) |
|--|--|--|
| Goal | Personal / team music site | Public showcase only |
| CF command | `npm run deploy:cf` | `npm run deploy:cf:demo` |
| Node / Fly / Docker | `start:prod` / `fly deploy` / Docker | Not used for demo |
| `LIBRARY_READONLY` | **Unset / false** | `true` |
| Library | Can add/remove favorites, import, export | Read-only; no import/export |

Demo exists so maintainers can share a listen-only link. **Skip demo entirely** unless you explicitly want that. Agents automating deploy: use **§1 / §2 / §3 default steps only**; do not run `deploy:cf:demo` unless the user asked for a read-only gallery.

---

Pick a path by how you want to run the BFF:

| Target | Runtime | Library storage | Good for |
|--------|---------|-----------------|----------|
| **Cloudflare Workers** | `server/worker.ts` | Free **D1** | Production edge, free tier |
| **Node VPS** | `server/node.ts` | SQLite under `MUSIC_DATA_DIR` | Full control, cheap VPS |
| **Fly.io** | Docker → Node | Persistent volume | Global VM, simple TLS |
| **Vercel** | Limited | See below | **Not ideal as full stack** |

Agents: follow the section for your target top-to-bottom; do not commit secrets.

---

## 0. Common prep

```bash
git clone <your-fork-or-this-repo> music-du
cd music-du
cp .env.example .env
npm ci
npm test && npm run typecheck
```

Fill `.env` (names only — see [`.env.example`](../.env.example)):

| Variable | Required | Notes |
|----------|----------|--------|
| `CHKSZ_API_BASE` | No | Default `https://api.chksz.com` |
| `CHKSZ_APIKEY` / `CHKSZ_FALLBACK_APIKEYS` | **Yes** for ChKSz | Server-only; `.com` requires `apikey` |
| `HOST` / `PORT` | Node | Default `127.0.0.1:8787` |
| `MUSIC_DATA_DIR` | Node | Default `./data` |
| `LIBRARY_READONLY` | **Demo only — leave unset for your site** | `true` = no library writes / no export |
| `LIBRARY_TOKEN` | Node, optional | If set, library / `/favs` / `/import` require `Authorization: Bearer …` |
| `MUSIC_ALLOWED_ORIGINS` | Node, optional | Extra CORS origins. Same-origin SPA does not need this. |

Local:

```bash
npm run dev          # http://127.0.0.1:8787
```

---

## 1. Cloudflare Workers (recommended production)

### 1.1 One-time

1. Cloudflare account + `npx wrangler login`  
2. Edit [`wrangler.toml`](../wrangler.toml): set Worker `name`, create D1:

```bash
npm run setup:d1
# paste database_id into wrangler.toml [[d1_databases]]
npx wrangler d1 migrations apply music-du-library --remote
```

3. Secrets:

```bash
npx wrangler secret put CHKSZ_APIKEY
# optional extra keys: npx wrangler secret put CHKSZ_FALLBACK_APIKEYS
```

4. **Do not** set `LIBRARY_READONLY` on the main Worker.

5. Custom domain: Workers → your Worker → **Domains & Routes** → add hostname.  
6. Put [Cloudflare Access](./ACCESS.md) on private hostnames — that session is library permission.

### 1.2 Deploy (your site — default)

```bash
npm run build
npx wrangler deploy
# same as: npm run deploy:cf
```

This is the install you want: full library read/write. **Stop here** unless you also want a public showcase.

CI (upstream maintainer repo only): [`.github/workflows/ci.yml`](../.github/workflows/ci.yml). Forks run **tests only** — wire your own deploy if needed.

### 1.3 Demo mode (optional — skip for self-hosting)

Only if you want a **second** public Worker that cannot change favorites:

```bash
npm run deploy:cf:demo   # wrangler deploy --env demo
```

```toml
# [env.demo] only — never on the default Worker
[env.demo.vars]
LIBRARY_READONLY = "true"
```

- Uses a **separate D1** (`music-du-demo`), never the production library  
- `GET /api/library` public; response **omits `history` / `curIdx`**  
- `PUT` / `DELETE` / `/favs` / `/import` → 403  
- SPA shows read-only banner  
- Self-hosters: **ignore this subsection**

---

## 2. Node on a VPS

### 2.1 Build & run

```bash
cp .env.example .env
# edit .env — set gateway keys, HOST=0.0.0.0, PORT=8787
# If the port is on the public internet, also set LIBRARY_TOKEN=
npm ci
npm run build
NODE_ENV=production node dist/server/node.js
```

Or:

```bash
npm run start:prod
```

Persist `MUSIC_DATA_DIR` (SQLite + caches) across deploys.

`HOST=0.0.0.0` without a reverse-proxy login exposes `/api/library`. Set `LIBRARY_TOKEN` (and put the same value in the browser `localStorage` key `kazam.v2.libraryToken`) or keep the process behind Caddy/nginx + your own auth. Local `127.0.0.1` can leave the token unset.

### 2.2 systemd sketch

```ini
[Unit]
Description=music-du
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/music-du
EnvironmentFile=/opt/music-du/.env
ExecStart=/usr/bin/node dist/server/node.js
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

### 2.3 Reverse proxy (Caddy / nginx)

Terminate TLS; proxy to `127.0.0.1:8787`.  
WebSocket not required. Increase body size if you use large `/import` uploads.

### 2.4 Docker on VPS

```bash
docker build -t music-du .
docker run -d --name music-du \
  -p 8787:8787 \
  -v music-data:/data \
  -e CHKSZ_FALLBACK_APIKEYS=… \
  -e HOST=0.0.0.0 \
  music-du
```

---

## 3. Fly.io

Files: [`Dockerfile`](../Dockerfile), [`fly.toml`](../fly.toml)

```bash
# install flyctl, login
fly launch --no-deploy   # or edit fly.toml app name
fly volumes create music_data --size 1 --region nrt
fly secrets set CHKSZ_FALLBACK_APIKEYS="…"
fly deploy
fly status
fly open
```

Notes:

- SQLite lives on the volume at `/data`  
- Scale-to-zero is fine for personal use; cold starts apply  
- For multi-machine, SQLite is **not** shared — use one machine or move library to external DB (not built-in)

---

## 4. Vercel

### Reality check

This app is a **same-origin SPA + stateful BFF** (library SQLite/D1, long-ish song resolve).  
**Vercel Serverless + ephemeral FS** does not match that well:

| Piece | On Vercel |
|-------|-----------|
| Static SPA (`dist/client`) | Easy (static deploy) |
| Hono API + SQLite file | **Ephemeral** — library resets every cold start |
| Cloudflare D1 binding | **Not available** on Vercel |
| Long upstream resolve | Function timeouts |

### Practical options

**A. Frontend on Vercel, API elsewhere (recommended if you want Vercel)**  

1. Deploy Node/Fly/CF Worker as API origin `https://api.example.com`  
2. Deploy SPA to Vercel  
3. Either:  
   - Set Vite `server.proxy` only for local dev, and in production configure the SPA to call the API origin (requires a small client `API_BASE` change — not default), **or**  
   - Put Vercel behind a reverse proxy that routes `/api/*` to the BFF  

**B. Full stack on Vercel (not supported out of the box)**  

Would need a rewrite to serverless handlers + external Postgres/Turso for library — a separate project.

**C. Prefer Cloudflare Workers or Fly for “one deploy” open-source demos.**

---

## 5. Environment matrix

| Concern | Workers | Node / Fly |
|---------|---------|------------|
| Secrets | `wrangler secret put` | `.env` / platform secrets |
| Library | D1 | SQLite file |
| Audio | 302 to CDN | 302 or optional byte proxy |
| Charts cache | Cache API | Disk under `data/` |
| Import/export | Worker HTML + JSON (2MB cap) | Same `/favs` + `/import` on Node (exact-id JSON) |

---

## 6. Post-deploy checklist

```bash
curl -sS "$BASE/api/health" | jq .
curl -sS "$BASE/api/search?q=test&limit=1" | jq .
curl -sS "$BASE/api/library" | jq .
# demo only:
curl -sS -o /dev/null -w "%{http_code}\n" -X PUT "$BASE/api/library"  # expect 403
```

Or: `SMOKE_BASE=https://your.host bash scripts/smoke-prod.sh`

---

## 7. Hardening private installs

1. Cloudflare Access or reverse-proxy auth on the whole site  
2. Rate-limit search/song at the edge if the site is public  
3. Separate **demo** Worker with `LIBRARY_READONLY=true`  
4. Read [MUSIC-PROVIDERS.md](./MUSIC-PROVIDERS.md) for API legality  

---

## 8. Agent-oriented “do this” summary

Deploy the **user’s own writable site**. Do **not** enable demo / `LIBRARY_READONLY` / `deploy:cf:demo` unless the user explicitly asked for a public read-only gallery.

```text
1. npm ci && cp .env.example .env && fill server secrets
2. npm test && npm run typecheck
3a. CF: setup:d1 → paste id → wrangler secret put → npm run deploy:cf
   (NOT deploy:cf:demo)
3b. Node: npm run build && HOST=0.0.0.0 node dist/server/node.js
3c. Fly: fly launch + volume + secrets + fly deploy
4. curl /api/health and /api/search
5. Never commit .env or data/
6. Skip demo unless user asked for LIBRARY_READONLY showcase
```
