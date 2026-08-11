# music-du

[English](./README.md) · [简体中文](./README.zh-CN.md)

[![CI](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml/badge.svg)](https://github.com/sonnemusk/music-du/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js ≥ 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

开源的**个人音乐 Web 应用**：搜索、榜单、收藏、歌词、多套皮肤。

**技术栈：** TypeScript · [Hono](https://hono.dev) BFF · React + Zustand · **Cloudflare Workers + D1**，或 **Node + SQLite**（VPS / Fly / Docker）。

| | |
|--|--|
| **在线 Demo（只读）** | https://music.du.dev — 可听、可逛；**不能**改收藏 |
| **自建正式站（默认）** | 可读写 · `npm run deploy:cf` / Node / Fly — 见[部署](#部署自建正式站--默认) |

> 自建永远部署**可写正式版**。Demo 只读仅用于公开展示，可整段忽略。

```text
浏览器 SPA  ──同源 /api/*──►  Worker 或 Node BFF
                                ├─ 你自己的音乐网关（环境变量）
                                ├─ 曲库（D1 或 SQLite）
                                └─ 榜单 · 封面 · 歌词
```

<details>
<summary><strong>目录</strong></summary>

- [截图](#截图)
- [功能](#功能)
- [环境要求](#环境要求)
- [本地快速开始](#本地快速开始)
- [部署](#部署自建正式站--默认)
- [环境变量](#环境变量)
- [文档索引](#文档索引)
- [脚本](#脚本)
- [目录结构](#目录结构)
- [HTTP API](#http-api速查)
- [可选 Demo](#可选只读-demo展示用)
- [免责声明](#免责声明)
- [贡献](#贡献)
- [许可证](#许可证)

</details>

---

## 截图

以下资源在 README 中**统一按 960px 宽**展示，大小一致、对齐整齐。

### 1. 一键换肤（GIF 动图）

- **操作：** 右上角 **主题 · …** 或 **一键切换**，循环切换皮肤  
- **文件：** `docs/screenshots/skins-cycle.gif`  
- **清晰度：** 源图 **1280×800**，每个主题约 **1 秒**，高清色板、**无抖动**（界面文字更清楚）

<p align="center">
  <img src="docs/screenshots/skins-cycle.gif" alt="GIF：一键切换皮肤" width="960" />
</p>

<p align="center"><b>一键换肤演示</b></p>

### 2. 主要界面（静图，尺寸相同）

源图均为 **1440×900** JPEG；页面展示宽度统一 **960px**。

<p align="center">
  <img src="docs/screenshots/favorites-grape.jpg" alt="喜欢页 · 葡萄皮肤" width="960" /><br/>
  <b>喜欢</b> — 收藏列表 + 播放器 · 皮肤「葡萄」
</p>

<p align="center">
  <img src="docs/screenshots/lyrics-forest.jpg" alt="歌词页 · 密林皮肤" width="960" /><br/>
  <b>歌词</b> — 中英歌词跟滚 · 皮肤「密林」
</p>

<p align="center">
  <img src="docs/screenshots/charts-sakura.jpg" alt="热榜页 · 墨红花皮肤" width="960" /><br/>
  <b>热榜</b> — 多平台飙升/热歌/新歌 · 皮肤「墨红花」
</p>

---

## 功能

- **播放** — 优先直链 CDN、列表/单曲/随机、Media Session、音质选择  
- **曲库** — 列表 · 喜欢 · 历史 · 多端 `revision` 乐观锁  
- **发现** — 关键词搜索 · 多平台榜单（飙升 / 热歌 / 新歌）  
- **歌词** — 多源解析 + 本地缓存 + 跟滚  
- **皮肤** — 多主题 × 侧栏 / 沉浸 / 紧凑布局  
- **导入导出** — `/favs` JSON、`/import`（按 id 或歌名列表）  
- **快捷键** — `空格` 播放/暂停 · `N` / `P` 下一首/上一首 · 应用内还有更多  
- **语言** — 界面默认**中文**，点顶栏 **EN** 可切到 English（偏好保存在浏览器 `localStorage`）  

说明：[docs/FEATURES.md](./docs/FEATURES.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 环境要求

- **Node.js ≥ 20**
- 可选：Cloudflare 账号 + [Wrangler](https://developers.cloudflare.com/workers/wrangler/)  
- 你有权使用的**音乐网关 / API**（见[免责声明](#免责声明)）

---

## 本地快速开始

```bash
git clone https://github.com/sonnemusk/music-du.git
cd music-du
cp .env.example .env
# 编辑 .env — 网关地址 / 密钥（仅服务端）。详见 .env.example。

npm ci
npm run dev          # http://127.0.0.1:8787
```

```bash
npm test && npm run typecheck
npm run build && npm run start:prod
```

---

## 部署（自建正式站 · 默认）

完整步骤：**[docs/DEPLOY.md](./docs/DEPLOY.md)** · 文档索引：**[docs/README.md](./docs/README.md)**

| 目标 | 一句话 |
|------|--------|
| **Cloudflare** | `npm run setup:d1` → secrets → **`npm run deploy:cf`** |
| **Node VPS** | `npm run build && HOST=0.0.0.0 node dist/server/node.js` |
| **Fly.io** | `fly launch` + 数据卷 + secrets → `fly deploy` |
| **Docker** | `docker build -t music-du .` + 挂载 `/data` |
| **Vercel** | 不适合整包 — [原因](./docs/DEPLOY.md#4-vercel) |
| **Demo 只读** | 可选 `npm run deploy:cf:demo` — **不是**自建默认路径 |

### Cloudflare（最常用）

```bash
npm run setup:d1                              # 把 database_id 填进 wrangler.toml
npx wrangler secret put MUSIC_ACCESS_TOKEN    # 私人站建议配置
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS  # 备用网关需要 key 时
npm run deploy:cf                             # 可写正式站 — 不是 demo
```

控制台绑定自定义域名。可选：[Access](./docs/ACCESS.md)。

### Node / Docker

```bash
# 裸机
npm ci && npm run build
HOST=0.0.0.0 PORT=8787 NODE_ENV=production node dist/server/node.js

# Docker
docker build -t music-du .
docker run -d -p 8787:8787 -v music-data:/data \
  -e MUSIC_ACCESS_TOKEN=… -e CHKSZ_FALLBACK_APIKEYS=… music-du
```

请持久化 `MUSIC_DATA_DIR` / 数据卷（SQLite + 缓存）。

### Fly.io

```bash
fly launch --no-deploy
fly volumes create music_data --size 1
fly secrets set MUSIC_ACCESS_TOKEN=… CHKSZ_FALLBACK_APIKEYS=…
fly deploy
```

见 [`Dockerfile`](./Dockerfile) · [`fly.toml`](./fly.toml)。

---

## 环境变量

复制 [`.env.example`](./.env.example)。**切勿提交** `.env`、`.dev.vars` 或 `data/*`。

| 变量 | 位置 | 作用 |
|------|------|------|
| `CHKSZ_API_BASE` | 服务端 | 主音乐网关 Base URL |
| `CHKSZ_FALLBACK_BASE` / `CHKSZ_FALLBACK_APIKEYS` | 服务端 | 备用主机 + key（**禁止**进浏览器） |
| `MUSIC_ACCESS_TOKEN` | 服务端 | 配置后保护 `/api/library` |
| `VITE_MUSIC_ACCESS_TOKEN` | 构建（可选） | SPA 默认 token — 公开 Demo 不要 bake |
| `LIBRARY_READONLY` | Worker **仅 Demo** | 自建站**不要设** |
| `LIBRARY_TOKEN_REQUIRED_HOSTS` | Worker | 这些域名上必须配置 library token |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node | 监听地址 + SQLite 目录 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| **[docs/README.md](./docs/README.md)** | 文档总目录 |
| **[docs/DEPLOY.md](./docs/DEPLOY.md)** | CF · VPS · Fly · Docker · Vercel |
| **[docs/API.md](./docs/API.md)** | 完整 HTTP API |
| **[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)** | 音乐 API、版权、对接自有接口 |
| **[docs/ACCESS.md](./docs/ACCESS.md)** | Access + 库 token |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | 架构 |
| **[SECURITY.md](./SECURITY.md)** | 密钥与安全 |

**给 Agent：** [docs/DEPLOY.md §8](./docs/DEPLOY.md) → [docs/API.md](./docs/API.md)。默认部署**可写正式站**。

> 详细技术文档以英文 `docs/*.md` 为主（命令与路径通用）；本页覆盖中文读者的关键决策。

---

## 脚本

| 脚本 | 作用 |
|------|------|
| `npm run dev` | 本地开发 |
| `npm run build` | 构建 |
| `npm run start:prod` | Node 生产（**自建站**） |
| `npm test` / `typecheck` | 测试 / 类型检查 |
| `npm run smoke` | HTTP 冒烟 |
| `npm run setup:d1` | 创建 D1 |
| `npm run deploy:cf` | **默认** CF 可写部署 |
| `npm run deploy:cf:demo` | 可选只读第二 Worker |

---

## 目录结构

```text
client/       React SPA（Vite）
server/       Hono BFF — node.ts · worker.ts
docs/         部署、API、截图
migrations/   D1 SQL
scripts/      smoke、D1
tests/        Vitest
data/         运行时（gitignore）
```

---

## HTTP API（速查）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查、`readOnly` |
| GET | `/api/search` | `?q=` |
| GET | `/api/charts` · `/api/charts/:platform` | 飙升 / 热歌 / 新歌 |
| GET | `/api/song/:sid` | 解析播放地址 |
| GET | `/api/song/:sid/qualities` | 音质列表 |
| GET | `/api/stream/:sid` | CF：**302** 到 CDN |
| GET | `/api/lyric/:sid` | 歌词 |
| GET | `/api/cover-proxy` | 封面代理 |
| GET/PUT | `/api/library` | 配置 token 时需鉴权 |
| DELETE | `/api/library/:listType/:sid` | playlist / favorites / history |
| GET | `/favs` · `/export` | 导出收藏 JSON |
| GET/POST | `/import` | 按 id 或歌名导入 |

完整说明：**[docs/API.md](./docs/API.md)**。

---

## 可选：只读 Demo（展示用）

只想搭自己的站时，整节可跳过。

在线展示：**https://music.du.dev**（只读）

自己再挂一个只读 Worker：

```bash
npm run deploy:cf:demo
```

```toml
# 仅 [env.demo]
LIBRARY_READONLY = "true"
```

| | 自建站（默认） | Demo（可选） |
|--|--|--|
| 命令 | `deploy:cf` / Node / Fly | 仅 `deploy:cf:demo` |
| 曲库 | **可读写** | 只读 |
| `LIBRARY_READONLY` | 不设置 | `true` |
| 示例 | 你的域名 | https://music.du.dev |

---

## 免责声明

本仓库是**播放器 + BFF**，**不附带**正版曲库。

- 必须使用**合法** API / 内容来源  
- 默认环境可能指向社区兼容网关，**可用性与合规由你负责**  
- 对接自有 API：**[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)**  

---

## 贡献

- 网关 key **只放服务端**  
- PR 前：`npm test && npm run typecheck`  
- 勿提交 `.env`、个人曲库、真实密钥  

---

## 许可证

[MIT](./LICENSE)
