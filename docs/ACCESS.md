# Cloudflare Access (free Zero Trust)

Whole site + export are protected at the **edge** with Cloudflare Access  
(no paid products — free Zero Trust seats / Access policies).

## What is protected

| Resource | How |
|----------|-----|
| `music.dubin.cc` / `.one` / `.vip` **entire site** | Access app **`music-site`** |
| Browser users | Email OTP allow-list (same as NAS) |
| CI smoke | Access **Service Token** (non-identity policy) |
| `/api/library` | Additionally: app `MUSIC_ACCESS_TOKEN` (`X-Music-Token`) |
| `/import` | Access only — upload favorites JSON to merge into D1 |

`/favs` `/export` `/import` no longer use the app token; they rely on Access  
(login for humans, service token for automation).

## Applications (account)

1. **`music-site`** — self-hosted domains:
   - `music.dubin.cc`
   - `music.dubin.one`
   - `music.dubin.vip`
2. **`music-favorites-export`** — path-level (legacy, still fine as extra layer):
   - `…/favs`, `…/export`

## Policies

**Allow music owners** (identity):

- `sonnemusk@gmail.com`
- `beanbest@outlook.com`
- `admin@dubin.cc`

**CI service token** (non_identity):

- Service token name: `music-du-ci-smoke`
- Headers on requests:
  - `CF-Access-Client-Id`
  - `CF-Access-Client-Secret`

GitHub Actions secrets:

- `CF_ACCESS_CLIENT_ID`
- `CF_ACCESS_CLIENT_SECRET`
- `MUSIC_ACCESS_TOKEN` (library API only)

## Local smoke

```bash
export CF_ACCESS_CLIENT_ID=...
export CF_ACCESS_CLIENT_SECRET=...
export MUSIC_ACCESS_TOKEN=...
bash scripts/smoke-prod.sh
```

Without the service token, unauthenticated `curl` to the site gets **302** to  
`*.cloudflareaccess.com` login — expected.

## Library multi-device (app layer)

Independent of Access: D1 stores `library_meta.revision`.

- `GET /api/library` → `{ …, revision }`
- `PUT /api/library` with body `revision` — mismatch → **409** + current data
- `DELETE …?revision=` — same

Client applies 409 payload and toasts “已在其他设备更新”.
