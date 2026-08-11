# Security

## Reporting

If you find a vulnerability in this repository (auth bypass, secret leak, XSS, etc.), please open a **private** security advisory on GitHub or contact the maintainer — do not open a public issue with exploit details.

## Secrets checklist (before open-sourcing a fork)

Never commit:

| Path / pattern | Why |
|----------------|-----|
| `.env`, `.dev.vars` | Real tokens and gateway keys |
| `data/*` (except `.gitkeep`) | Personal library / import dumps |
| Baked `VITE_MUSIC_ACCESS_TOKEN` in public builds | Exposes library write token |

Production secrets belong in:

- Cloudflare Worker **Secrets**
- Host env / systemd / Docker secrets
- GitHub Actions **encrypted secrets**

## Trust model

- The browser never needs the music **gateway** API key; only the server/Worker does.
- `MUSIC_ACCESS_TOKEN` protects **library write/read APIs** when configured; put the SPA behind SSO/Access for private installs.
- `LIBRARY_READONLY=true` disables library mutations and import/export (public demo mode).

## Content & copyright

This app is a **client + BFF**. It does not ship licensed music catalogs. You must supply a lawful music API / rights chain. See [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md).
