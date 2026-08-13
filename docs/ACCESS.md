# Optional edge auth (Cloudflare Access)

Private installs can put the **whole site** (or only export/import paths) behind free Cloudflare Zero Trust **Access**. This is independent of the app’s `MUSIC_ACCESS_TOKEN`.

## Suggested layout

| Resource | Protection |
|----------|------------|
| Private music hostname | Access app (email OTP / IdP allow-list) |
| `GET/POST /import`, `GET /favs` | Access (humans) + optional path rules |
| `GET/PUT/DELETE /api/library` | Access **and** `MUSIC_ACCESS_TOKEN` |
| Public demo hostname | **No** Access · `LIBRARY_READONLY=true` |

**Never** put the public demo hostname in the same Access application as your private site.

## Application examples

1. **music-site** — include only your private hostnames  
2. Optional path app for `/favs` `/export` `/import` if you want finer rules  

## Policies

- **Allow** your identity providers / emails  
- **CI service token** (non-identity) if automated smoke must bypass login:
  - Headers: `CF-Access-Client-Id`, `CF-Access-Client-Secret`
  - Store as GitHub Actions secrets, not in git  

## App library token

When Worker secret `MUSIC_ACCESS_TOKEN` is set:

```http
GET /api/library
X-Music-Token: <token>
```

SPA: runtime `localStorage.music.accessToken` only. Never bake `VITE_MUSIC_ACCESS_TOKEN` into a production bundle.

Optional Worker var `LIBRARY_TOKEN_REQUIRED_HOSTS=your.domain.com` — if the secret is missing on that host, library APIs return **503** (fail closed).

## Local smoke through Access

```bash
export CF_ACCESS_CLIENT_ID=...
export CF_ACCESS_CLIENT_SECRET=...
export MUSIC_ACCESS_TOKEN=...
export SMOKE_BASE=https://your-private-host
bash scripts/smoke-prod.sh
```

Unauthenticated browser hits get **302** to `*.cloudflareaccess.com` — expected.

## Library multi-device (app layer)

Independent of Access: D1/SQLite `revision`.

- `GET /api/library` → data + `revision`  
- `PUT` / `DELETE` with matching `revision` — else **409** + current data  

Details: [API.md](./API.md).
