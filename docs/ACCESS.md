# Optional edge auth (Cloudflare Access)

Two hostnames, two rules:

| Site | Hostname example | Cloudflare Access | Library |
|------|------------------|-------------------|---------|
| **Private** | `music.dubin.cc` | **Required** (email OTP / IdP) | Read + write. Access login **is** permission. |
| **Demo** | `music.du.dev` | **None** — must stay public | Read favorites only. Writes / `/favs` / `/import` → **403**. |

There is no app-level library token on the **Worker**. Do **not** add the demo hostname to the private Access application.

Node / Docker installs that bind `0.0.0.0` without a reverse-proxy login should set **`LIBRARY_TOKEN`** (see [DEPLOY.md](./DEPLOY.md) §2). The SPA can send it from `localStorage["kazam.v2.libraryToken"]`. Leave it unset for local `127.0.0.1` dev.

## Suggested Access app

Only private hostnames. Demo stays off Access.

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

On the **private** host, unauthenticated hits get **302** to `*.cloudflareaccess.com`. The demo host must stay a normal 200 with no Access login.

## Library multi-device (app layer)

Independent of Access: D1/SQLite `revision`.

- `GET /api/library` → data + `revision`  
- `PUT` / `DELETE` with matching `revision` — else **409** + current data  

Details: [API.md](./API.md).
