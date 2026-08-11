# Music providers & copyright

## What this project is (and is not)

**music-du** is an open-source **web player + BFF**:

- UI for search, charts, library, lyrics, themes
- Server endpoints that **call a music metadata / stream API you configure**
- Local or D1 storage for **your** playlists / favorites metadata

It does **not**:

- Ship a licensed music catalog
- Host audio files on Cloudflare (Workers path returns **302** to a remote CDN URL)
- Grant you rights to redistribute commercial music

**You** are responsible for:

1. Choosing a lawful API / content source  
2. Complying with that provider’s ToS and local copyright law  
3. Keeping API keys on the **server** only  

This repository only shows how to **integrate** a gateway. If you already have an API, point the env vars at it (or adapt `server/chksz.ts` / `server/play.ts`).

---

## Built-in adapter (ChKSz-style NetEase gateway)

Out of the box the server talks to a **third-party NetEase-compatible HTTP gateway**:

| Role | Default base | Key |
|------|----------------|-----|
| Primary | `https://api.chksz.top` | Usually **none** (community free tier — availability not guaranteed) |
| Fallback | `https://api.chksz.com` | **Required** (`CHKSZ_FALLBACK_APIKEYS` / `CHKSZ_APIKEY`) |

Implementation: [`server/chksz.ts`](../server/chksz.ts)  
Env: [`.env.example`](../.env.example)

Typical gateway paths used by the adapter (provider-specific; may change):

- Search: `/cloudsearch` or equivalent  
- Song URL: `/song/url/v1`  
- Lyric: `/lyric`  

**Important:** These community mirrors are **not** official NetEase Cloud Music APIs. Availability, rate limits, and legality vary by region and over time. Prefer a source you control or have a license for in production.

Configure:

```bash
CHKSZ_API_BASE=https://your-gateway.example
CHKSZ_FALLBACK_BASE=https://your-backup.example
CHKSZ_FALLBACK_APIKEYS=key1,key2   # only if the host requires apikey=
```

---

## Recommended approaches (lawful / self-owned)

Use these as **patterns** — not endorsements of any piracy service:

### 1. Self-hosted open-source music API (own account cookies / tokens)

Projects in the community reverse-engineer official mobile/web APIs for **personal** use (e.g. NeteaseCloudMusicApi-style servers). You typically:

- Run the API on **your** VPS  
- Use **your own** logged-in credentials  
- Point `CHKSZ_API_BASE` at `http://127.0.0.1:3000` (or adapt paths in `chksz.ts`)

Still: personal listening ≠ public redistribution. Do not expose an unauthenticated public stream proxy.

### 2. Official platform SDKs / partner APIs

- Spotify Web API / Playback SDK (requires Spotify Developer app + Premium for full playback)  
- Apple Music MusicKit  
- Amazon Music / YouTube Data + compliance for audio  

These usually **do not** return raw MP3 URLs for free embedding the way this BFF expects. You would replace `resolvePlay` / `chksz.fetchMusic` with the platform’s player SDK.

### 3. Your own catalog

- Upload audio to **your** object storage (S3/R2/MinIO) under licenses you hold  
- Implement a thin API: `search` + `GET /song/:id → { url }`  
- Point the BFF at that API or fork `server/play.ts`

### 4. Radio / Creative Commons

- Free Music Archive, Jamendo, Internet Archive feeds  
- Map results into the app’s `Track` shape (`id`, `name`, `artist`, `cover`, `duration`, stream URL)

---

## How to plug in “my own API”

Minimal contract the SPA expects via this BFF:

| Capability | BFF route | Upstream responsibility |
|------------|-----------|-------------------------|
| Search | `GET /api/search?q=` | Return tracks with stable `id` |
| Resolve stream | `GET /api/song/:sid` | Return playable `https://…` URL |
| Qualities (optional) | `GET /api/song/:sid/qualities` | List levels + URLs |
| Lyric (optional) | `GET /api/lyric/:sid` | LRC / plain text |
| Charts (optional) | `GET /api/charts/:platform` | Ranked track lists |

Easiest path: keep Hono routes, swap the body of [`server/chksz.ts`](../server/chksz.ts) to call your HTTP API and map JSON → `Track`.

---

## Demo / open-source hygiene

- Public demos should use `LIBRARY_READONLY=true` so visitors cannot mutate **your** library.  
- Do not bake personal gateway keys into client bundles.  
- Do not commit `data/` libraries or export dumps.

---

## Disclaimer

Software is provided under the MIT license **as-is**. Maintainers are not liable for misuse of third-party APIs or copyright infringement by deployers. When in doubt, use content you own or platforms that grant you a commercial/streaming license.
