# music-du

[English](./README.md) · [简体中文](./README.zh-CN.md)

[![CI](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml/badge.svg)](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

开源的**个人音乐 Web 应用** — 搜索、榜单、收藏、歌词、多套皮肤。

**技术栈：** TypeScript · [Hono](https://hono.dev) · React + Zustand · **Cloudflare Workers + D1** 或 **Node + SQLite**（VPS / Fly / Docker）。

| | |
|--|--|
| **在线 Demo（只读）** | https://music.du.dev |
| **自建（默认）** | 可读写完整站 — [部署](#部署) |

```text
SPA  ── /api/* ──►  Worker 或 Node
                      ├─ 你的音乐网关
                      ├─ 曲库（D1 / SQLite）
                      └─ 榜单 · 封面 · 歌词
```

<details>
<summary>目录</summary>

- [截图](#截图) · [功能](#功能) · [快速开始](#快速开始)
- [部署](#部署) · [环境变量](#环境变量) · [文档](#文档)
- [API](#http-api) · [Demo](#可选只读-demo) · [免责声明](#免责声明)

</details>

---

## 截图

右上角可切换 **语言**（中文 / English）和 **主题**（主题 · 一键切换）。

<p align="center">
  <img src="docs/screenshots/skins-cycle.gif" alt="一键换肤" width="960" /><br/>
  <em>一键换肤</em>
</p>

<p align="center">
  <img src="docs/screenshots/search-ice.jpg" alt="搜索" width="960" /><br/>
  <em>搜索</em>
</p>

<p align="center">
  <img src="docs/screenshots/favorites-grape.jpg" alt="喜欢" width="960" /><br/>
  <em>喜欢 · 收藏 + 播放器</em>
</p>

<p align="center">
  <img src="docs/screenshots/lyrics-forest.jpg" alt="歌词" width="960" /><br/>
  <em>歌词 · 中英跟滚</em>
</p>

<p align="center">
  <img src="docs/screenshots/charts-sakura.jpg" alt="热榜" width="960" /><br/>
  <em>热榜 · 多平台榜单</em>
</p>

---

## 功能

- **播放** — CDN 直链、列表/单曲/随机、Media Session、音质选择  
- **曲库** — 列表 · 喜欢 · 历史 · 多端 revision 锁  
- **发现** — 搜索 · 榜单（飙升 / 热歌 / 新歌）  
- **歌词** — 多源解析 + 缓存 + 跟滚  
- **皮肤** — 多主题 × 侧栏 / 沉浸 / 紧凑  
- **导入导出** — `/favs`、`/import`  
- **语言** — 默认**中文**，顶栏可切 **English**  
- **快捷键** — `空格` · `N` / `P` 切歌  

---

## 快速开始

```bash
git clone https://github.com/sonnemusk/music-du.git
cd music-du
cp .env.example .env   # 配置网关地址 / 密钥（仅服务端）
npm ci
npm run dev            # http://127.0.0.1:8787
```

需要 **Node.js ≥ 20**。测试：`npm test && npm run typecheck`。

---

## 部署

**默认 = 你自己的可写站点。** 自建不需要部署 Demo Worker。

完整说明：**[docs/DEPLOY.md](./docs/DEPLOY.md)**

| 目标 | 命令 |
|------|------|
| **Cloudflare** | `npm run setup:d1` → secrets → **`npm run deploy:cf`** |
| **Node VPS** | `npm run build && HOST=0.0.0.0 node dist/server/node.js` |
| **Fly.io** | 数据卷 + secrets → `fly deploy` |
| **Docker** | `docker build -t music-du .` · 挂载 `/data` |
| **Vercel** | 不适合整包 — [说明](./docs/DEPLOY.md#4-vercel) |

### Cloudflare

```bash
npm run setup:d1
npx wrangler secret put MUSIC_ACCESS_TOKEN      # 私人站建议配置
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS  # 备用网关需要时
npm run deploy:cf                               # 可写正式站，不是 demo
```

可选边缘鉴权：[docs/ACCESS.md](./docs/ACCESS.md)。

### Node / Docker

```bash
npm ci && npm run build
HOST=0.0.0.0 PORT=8787 NODE_ENV=production node dist/server/node.js

docker build -t music-du .
docker run -d -p 8787:8787 -v music-data:/data \
  -e MUSIC_ACCESS_TOKEN=… -e CHKSZ_FALLBACK_APIKEYS=… music-du
```

请持久化数据目录 / volume。

---

## 环境变量

见 [`.env.example`](./.env.example)。勿提交 `.env`、`.dev.vars`、`data/*`。

| 变量 | 作用 |
|------|------|
| `CHKSZ_API_BASE` | 主音乐网关（服务端） |
| `CHKSZ_FALLBACK_*` | 备用网关 + key（仅服务端） |
| `MUSIC_ACCESS_TOKEN` | 配置后保护 `/api/library` |
| `VITE_MUSIC_ACCESS_TOKEN` | 可选 bake 进 SPA — 公开 Demo 不要用 |
| `LIBRARY_READONLY` | 仅 Demo — 自建站不要设 |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node 监听与 SQLite 路径 |

---

## 文档

| 文档 | |
|------|--|
| [docs/DEPLOY.md](./docs/DEPLOY.md) | 部署分步 |
| [docs/API.md](./docs/API.md) | HTTP API |
| [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md) | 音乐 API 与版权 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 架构 |
| [docs/README.md](./docs/README.md) | 文档索引 |
| [SECURITY.md](./SECURITY.md) · [CONTRIBUTING.md](./CONTRIBUTING.md) | |

详细技术文档以英文 `docs/*.md` 为主（命令通用）。  
**Agent：** [DEPLOY §8](./docs/DEPLOY.md) → [API](./docs/API.md)，默认部署可写站。

---

## HTTP API

| | 路径 |
|--|------|
| 健康 / 搜索 / 榜单 | `GET /api/health` · `/api/search` · `/api/charts…` |
| 播放 | `GET /api/song/:id` · `/api/stream/:id` · `/api/lyric/:id` |
| 曲库 | `GET/PUT /api/library` · `DELETE /api/library/:list/:id` |
| 导入导出 | `GET /favs` · `GET/POST /import` |

详见 **[docs/API.md](./docs/API.md)**。

```text
client/   React SPA          server/   Hono（node.ts · worker.ts）
docs/     文档与截图          migrations/  D1 SQL
```

---

## 可选：只读 Demo

仅当你需要**第二个**公网「只能听、不能改」的站点时（例如 https://music.du.dev）。

```bash
npm run deploy:cf:demo   # 不是自建默认路径
```

该 Worker 上设置 `LIBRARY_READONLY=true`。收藏 / 导入 / 导出不可用。

---

## 免责声明

本项目是**播放器 + BFF**，不附带正版曲库。须使用**合法**音乐 API。  
默认环境可能指向社区网关，**合规由部署者负责**。  
对接方式见 [docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)。

---

## 许可证

[MIT](./LICENSE)
