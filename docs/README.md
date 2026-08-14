# Documentation index

[← Back to README](../README.md) · [中文 README](../README.zh-CN.md)

Technical docs are in **English** (commands and paths are language-neutral). Start with the language-specific README for product overview.

| Doc | Audience | Contents |
|-----|----------|----------|
| **[STATUS.md](./STATUS.md)** | Humans & agents | **Current facts** — read this first |
| [DEPLOY.md](./DEPLOY.md) | Humans & agents | Cloudflare · Node VPS · Fly · Docker · Vercel |
| [API.md](./API.md) | Integrators | Full HTTP API reference |
| [MUSIC-PROVIDERS.md](./MUSIC-PROVIDERS.md) | Operators | Lawful APIs, copyright, plug-in guide |
| [ACCESS.md](./ACCESS.md) | Operators | Private site = Access; demo = public read-only |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Contributors | Runtime design |
| [FEATURES.md](./FEATURES.md) | Product | Feature checklist |
| [../SECURITY.md](../SECURITY.md) | Everyone | Secrets & reporting |
| [screenshots/](./screenshots/) | README | UI stills + `skins-cycle.gif` |

Closed 2026-08-12 construction notes (do not execute): [OPTIMIZATION-PLAN.md](./OPTIMIZATION-PLAN.md) · [GROK-RUNBOOK.md](./GROK-RUNBOOK.md) · [EXECUTION-TRACKER.md](./EXECUTION-TRACKER.md)

## Deploy reminder

| Goal | Path |
|------|------|
| **Your writable site (default)** | [DEPLOY.md](./DEPLOY.md) §1–3 · `npm run deploy:cf` |
| Read-only public demo | [DEPLOY.md §1.3](./DEPLOY.md) · `npm run deploy:cf:demo` only if needed |

## Live demo

https://music.du.dev — read-only showcase (not required for self-hosting).
