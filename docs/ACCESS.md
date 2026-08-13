# Optional edge auth (Cloudflare Access)

Private installs put the **whole site** behind free Cloudflare Zero Trust **Access**. Anyone who can open the site can use the library. There is no second app token.

## Suggested layout

| Resource | Protection |
|----------|------------|
| Private music hostname | Access app (email OTP / IdP allow-list) |
| Library, `/favs`, `/import` | Same Access session (no extra header) |
| Public demo hostname | **No** Access · `LIBRARY_READONLY=true` |

**Never** put the public demo hostname in the same Access application as your private site.

## Application examples

1. **music-site** — include only your private hostnames  

## Policies

- **Allow** your identity providers / emails  
- **CI service token** (non-identity) if automated smoke must bypass login:
  - Headers: `CF-Access-Client-Id`, `CF-Access-Client-Secret`
  - Store as GitHub Actions secrets, not in git  

## Local smoke through Access

```bash
export CF_ACCESS_CLIENT_ID=...
export CF_ACCESS_CLIENT_SECRET=...
export SMOKE_BASE=https://your-private-host
bash scripts/smoke-prod.sh
```

Unauthenticated browser hits get **302** to `*.cloudflareaccess.com` — expected.

## Library multi-device (app layer)

Independent of Access: D1/SQLite `revision`.

- `GET /api/library` → data + `revision`  
- `PUT` / `DELETE` with matching `revision` — else **409** + current data  

Details: [API.md](./API.md).
