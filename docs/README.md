# Documentation index

[← Back to README](../README.md) · [中文 README](../README.zh-CN.md)

Technical docs are in **English** (commands and paths are language-neutral). Start with the language-specific README for product overview.

| Doc | Audience | Contents |
|-----|----------|----------|
| [DEPLOY.md](./DEPLOY.md) | Humans & agents | Cloudflare · Node VPS · Fly · Docker · Vercel |
| [API.md](./API.md) | Integrators | Full HTTP API reference |
| [MUSIC-PROVIDERS.md](./MUSIC-PROVIDERS.md) | Operators | Lawful APIs, copyright, plug-in guide |
| [ACCESS.md](./ACCESS.md) | Private installs | Cloudflare Access + library token |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Contributors | Runtime design |
| [FEATURES.md](./FEATURES.md) | Product | Feature checklist |
| [OPTIMIZATION-PLAN.md](./OPTIMIZATION-PLAN.md) | Maintainers & agents | 待办优化清单（移动端 · 前端交互 · D1 成本 · 工程质量） |
| [GROK-RUNBOOK.md](./GROK-RUNBOOK.md) | Maintainers | 逐条执行手册：32 段现成提示词 + 进度表 |
| [../SECURITY.md](../SECURITY.md) | Everyone | Secrets & reporting |
| [screenshots/](./screenshots/) | README | UI stills + `skins-cycle.gif` |

## Deploy reminder

| Goal | Path |
|------|------|
| **Your writable site (default)** | [DEPLOY.md](./DEPLOY.md) §1–3 · `npm run deploy:cf` |
| Read-only public demo | [DEPLOY.md §1.3](./DEPLOY.md) · `npm run deploy:cf:demo` only if needed |

## Live demo

https://music.du.dev — read-only showcase (not required for self-hosting).
