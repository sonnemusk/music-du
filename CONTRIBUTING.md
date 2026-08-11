# Contributing

Thanks for your interest in **music-du**.

## Before you open a PR

1. Read [README.md](./README.md) / [README.zh-CN.md](./README.zh-CN.md)
2. Run `npm ci && npm test && npm run typecheck`
3. Keep music gateway API keys **server-side only** (never in client bundles or commits)
4. Do not commit `.env`, `.dev.vars`, or personal `data/` libraries

## Scope notes

- Default deploy is a **writable personal install** — do not make demo/read-only the default path in docs or CI for forks
- Prefer small, focused PRs (UI, docs, server, or tests separately when possible)

## Reporting security issues

See [SECURITY.md](./SECURITY.md).
