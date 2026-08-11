# music-du

[English](./README.md) · [简体中文](./README.zh-CN.md)

开源的**个人音乐 Web 应用**：搜索、榜单、收藏、歌词、多套皮肤。

**技术栈：** TypeScript · [Hono](https://hono.dev) BFF · React + Zustand · **Cloudflare Workers + D1**，或 **Node + SQLite**（VPS / Fly / Docker）。

> **自建站点？** 部署**可读写的正式版**即可（`npm run deploy:cf` / Node / Fly）。  
> **Demo 只读版**仅用于公开展示，见[文末](#可选只读-demo展示用)。自建**不需要**部署 Demo。

```text
浏览器 SPA  ──同源 /api/*──►  Worker 或 Node BFF
                                ├─ 你自己的音乐网关（环境变量）
                                ├─ 曲库（D1 或 SQLite）
                                └─ 榜单 · 封面 · 歌词
```

---

## 截图

右上角 **主题 / 一键切换** 换肤。桌面端为侧栏播放器 + 列表。

| 喜欢 · 葡萄 | 歌词 · 密林 | 热榜 · 墨红花 |
|:---:|:---:|:---:|
| ![喜欢 · 葡萄皮肤](docs/screenshots/favorites-grape.jpg) | ![歌词 · 密林皮肤](docs/screenshots/lyrics-forest.jpg) | ![热榜 · 墨红花皮肤](docs/screenshots/charts-sakura.jpg) |

---

## 功能

- **播放** — 优先直链 CDN、列表/单曲/随机、Media Session、音质选择  
- **曲库** — 列表 · 喜欢 · 历史 · 多端 `revision` 乐观锁  
- **发现** — 关键词搜索 · 多平台榜单（飙升 / 热歌 / 新歌）  
- **歌词** — 多源解析 + 本地缓存 + 跟滚  
- **皮肤** — 多主题 × 侧栏 / 沉浸 / 紧凑布局  
- **导入导出** — `/favs` JSON、`/import`（按 id 或歌名列表）  
- **快捷键** — `空格` 播放/暂停 · `N` / `P` 下一首/上一首 · 应用内还有更多  

说明：[docs/FEATURES.md](./docs/FEATURES.md) · [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)

---

## 环境要求

- **Node.js ≥ 20**
- 可选：Cloudflare 账号 + [Wrangler](https://developers.cloudflare.com/workers/wrangler/)（Workers 部署）  
- 你有权使用的**音乐网关 / API**（见免责声明）

---

## 本地快速开始

```bash
git clone https://github.com/sonnemusk/music-du.git
cd music-du
cp .env.example .env
# 编辑 .env — 网关地址 / 密钥（仅服务端）。详见 .env.example 注释。

npm ci
npm run dev          # http://127.0.0.1:8787
```

```bash
npm test && npm run typecheck
npm run build && npm run start:prod
```

---

## 部署（自建正式站 · 默认）

完整步骤见 **[docs/DEPLOY.md](./docs/DEPLOY.md)**（Cloudflare · VPS · Fly · Docker · Vercel 说明）。

| 目标 | 一句话 |
|------|--------|
| **Cloudflare** | `npm run setup:d1` → 配 secrets → **`npm run deploy:cf`** |
| **Node VPS** | `npm run build && HOST=0.0.0.0 node dist/server/node.js` |
| **Fly.io** | `fly launch` + 数据卷 + secrets → `fly deploy` |
| **Vercel** | 不适合整包上云 — 仅静态或 API 另部（[原因](./docs/DEPLOY.md#4-vercel)） |
| **Demo 只读** | 可选：`npm run deploy:cf:demo` — **不是**自建默认路径 |

### Cloudflare（最常用）

```bash
npm run setup:d1                              # 把 database_id 填进 wrangler.toml
npx wrangler secret put MUSIC_ACCESS_TOKEN    # 私人站建议配置
npx wrangler secret put CHKSZ_FALLBACK_APIKEYS  # 备用网关需要 key 时
npm run deploy:cf                             # 可写正式站 — 不是 demo
```

在 Cloudflare 控制台绑定自定义域名。可选：[Access 鉴权](./docs/ACCESS.md)。

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

---

## 环境变量

复制 [`.env.example`](./.env.example)。**切勿提交** `.env`、`.dev.vars` 或 `data/*`。

| 变量 | 位置 | 作用 |
|------|------|------|
| `CHKSZ_API_BASE` | 服务端 | 主音乐网关 Base URL |
| `CHKSZ_FALLBACK_BASE` / `CHKSZ_FALLBACK_APIKEYS` | 服务端 | 备用主机 + key（**禁止**进浏览器） |
| `MUSIC_ACCESS_TOKEN` | 服务端 | 配置后保护 `/api/library` |
| `VITE_MUSIC_ACCESS_TOKEN` | 构建（可选） | SPA 默认 token — 公开 Demo 不要 bake |
| `LIBRARY_READONLY` | Worker **仅 Demo** | 自建站**不要设**；`true` = 展示只读 |
| `LIBRARY_TOKEN_REQUIRED_HOSTS` | Worker | 这些域名上必须配置 library token |
| `HOST` / `PORT` / `MUSIC_DATA_DIR` | Node | 监听地址 + SQLite 目录 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| **[docs/DEPLOY.md](./docs/DEPLOY.md)** | 分步：CF · VPS · Fly · Docker · Vercel |
| **[docs/API.md](./docs/API.md)** | 完整 HTTP API |
| **[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)** | 音乐 API、版权、如何对接自有接口 |
| **[docs/ACCESS.md](./docs/ACCESS.md)** | Cloudflare Access + 库 token |
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | 架构说明 |
| **[SECURITY.md](./SECURITY.md)** | 密钥与安全 |

**给 Agent：** 按 [docs/DEPLOY.md §8](./docs/DEPLOY.md) 清单执行，再读 [docs/API.md](./docs/API.md)。默认部署**可写正式站**；除非用户明确要求，否则不要上只读 Demo。

> 说明：详细技术文档目前以**英文**为主（API / 部署步骤命令通用）。本页覆盖自建与使用中的关键决策；深入字段与接口以 `docs/*.md` 为准。

---

## 脚本

| 脚本 | 作用 |
|------|------|
| `npm run dev` | 本地 Hono + Vite |
| `npm run build` | 产出 `dist/client` + `dist/server` |
| `npm run start:prod` | Node 生产（**自建站**） |
| `npm test` / `typecheck` | 测试 / 类型检查 |
| `npm run smoke` | 对已启动服务做 HTTP 冒烟 |
| `npm run setup:d1` | 创建免费 D1 |
| `npm run deploy:cf` | **默认** CF 部署（可写） |
| `npm run deploy:cf:demo` | 可选的只读第二 Worker |

---

## 目录结构

```text
client/       React SPA（Vite）
server/       Hono BFF — node.ts · worker.ts
docs/         部署、API、网关说明、截图
migrations/   D1 SQL
scripts/      smoke、D1 脚本
tests/        Vitest
data/         运行时数据（gitignore）
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
| GET/PUT | `/api/library` | 配置了 token 时需鉴权 |
| DELETE | `/api/library/:listType/:sid` | playlist / favorites / history |
| GET | `/favs` · `/export` | 导出收藏 JSON |
| GET/POST | `/import` | 按 id 或歌名合并导入 |

完整说明：**[docs/API.md](./docs/API.md)**。

---

## 可选：只读 Demo（展示用）

只想搭**自己的**音乐站时，可以整节跳过。

若需要**第二个**公网 Worker，只给别人听、不能改收藏 / 不能导出：

```bash
npm run deploy:cf:demo    # wrangler --env demo
```

```toml
# 仅 [env.demo] — 不要写到默认 Worker
LIBRARY_READONLY = "true"
```

| | 自建站（默认） | Demo（可选） |
|--|--|--|
| 命令 | `deploy:cf` / Node / Fly | 仅 `deploy:cf:demo` |
| 曲库 | **可读写** | 只读 |
| `LIBRARY_READONLY` | 不设置 | `true` |

---

## 免责声明

本仓库是**播放器 + BFF**，**不附带**正版曲库。

- 你必须使用**合法**的 API / 内容来源。  
- 默认环境可能指向社区网易云兼容网关，仅作便利；**可用性与合规由你负责**。  
- 如何对接自有 API：**[docs/MUSIC-PROVIDERS.md](./docs/MUSIC-PROVIDERS.md)**。

---

## 贡献

- 网关 key **只放服务端**  
- 提 PR 前跑 `npm test && npm run typecheck`  
- 勿提交 `.env`、个人曲库或真实密钥  

---

## 许可证

[MIT](./LICENSE)
