# Cloudflare Access for favorites export

`/favs` and `/export` intentionally **do not** use the app `MUSIC_ACCESS_TOKEN`.  
They are protected at the edge with **Cloudflare Zero Trust Access** (same pattern as `nas.dubin.cc`).

`/api/library` still uses the SPA header `X-Music-Token` (Worker secret `MUSIC_ACCESS_TOKEN`).

## What you get

| Path | Auth |
|------|------|
| `https://music.dubin.cc/favs` | Cloudflare Access (email OTP / your policy) |
| `https://music.dubin.cc/export` | same |
| `GET/PUT/DELETE /api/library` | `X-Music-Token` (SPA) |

## Dashboard setup (manual)

1. Zero Trust → **Access** → **Applications** → **Add an application** → Self-hosted  
2. Application name: `music-favorites-export`  
3. Application domain / path (add both if UI allows multi-destination):
   - `music.dubin.cc/favs`
   - `music.dubin.cc/export`  
   Optional: `music.dubin.one/favs`, `music.dubin.vip/favs`  
4. Session duration: e.g. `24h`  
5. Policy: **Allow** → include your emails (same as NAS app), e.g.:
   - `sonnemusk@gmail.com`
   - `beanbest@outlook.com`
   - `admin@dubin.cc`  
6. Identity provider: One-time PIN (already on account) or Google/GitHub  

Unauthenticated browsers hit the CF login page; after login the JSON downloads.

## API setup (idempotent)

If Access apps were created by deploy tooling, they look like:

- name: `music-favorites-export`
- destinations: `music.dubin.cc/favs`, `music.dubin.cc/export`
- policy: allow listed emails

## Smoke

```bash
# unauthenticated → 302 to Access login (or 401 from CF), not 5xx
curl -sI https://music.dubin.cc/favs | head -5

# after Access session cookie (browser), file downloads with count
```
