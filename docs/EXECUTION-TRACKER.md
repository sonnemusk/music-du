# 执行追踪（结案）

> 2026-08-12 那轮 32 条已全部合入并部署。本文不再当施工看板。  
> 当前仓库以 **[STATUS.md](./STATUS.md)** 为准。

更新：2026-08-14 · `main` @ `f68efe8`

---

## 对齐结论（仍然有效）

| 项 | 结论 |
|----|------|
| 部署 | push `main` → GitHub Actions 部署私有 Worker + demo Worker |
| Demo 库 | 独立 D1 `music-du-demo`（`b737232e-4c66-46f1-9d01-67a584bb131f`），**不是**生产库 |
| Demo 读 | GET 可含 favorites / playlist / revision；**剔除 `history` / `curIdx`** |
| Demo 写 | `LIBRARY_READONLY` → 403 |
| 私有站鉴权 | **Cloudflare Access**；没有应用层 `MUSIC_ACCESS_TOKEN` |
| Node 鉴权 | 可选 `LIBRARY_TOKEN`（未设则本地放开）；CORS 不反射任意 Origin |
| 搜索 IA | 方案 B：手机 🔍 + SearchOverlay；桌面头搜不变 |
| 默认皮肤 | `stage-dim` |
| 禁改 | Worker `/api/stream` 只 302，不代理音频字节 |

---

## 2026-08-12 原 32 条

全部 `[x]`。细节不必再扩：P0-1、M-1…M-12、P1-1…P1-5、F-1…F-10、Q-1…Q-4 均已在 `main`。

当时文末写的「F-2 只做了 memo」「Q-2 Node 已鉴权」「F-8 music-shell-v2」「49 主题 / 107 tests」**以当时为准，现在过期**。

---

## 2026-08-14 追加（已合入）

| 项 | 证据 |
|----|------|
| 搜索代数 + overlay 草稿态 | `player.ts` `searchGen`；`SearchOverlay` `draftDirty` |
| bootstrap 不改写已选队列 | `queueTouched` |
| 布局按需加载 | `SkinHost` `React.lazy`；主包 JS gzip ~61KB |
| 长列表真虚拟化 | `list-window.ts` + `TrackList`（≥80 行、非网格） |
| 手机音质 / 搜索层底 inset | `quality-wrap--keep`；`useSearchOverlayBottom` |
| Worker save 单组 batch + import 2MB + list 索引 | `worker.ts` |
| Node token / CORS / SSRF / 事务+revision / `/import` | `app.ts` `library.ts` `safe-url.ts` |
| 测试 | **46 files / 344 tests** |
| 主题 / 布局 | **71** 主题 · **14** 布局 |

CI 部署记录：https://github.com/sonnemusk/music-du/actions/runs/31819033396

---

## 不要再做

- 按旧 OPTIMIZATION-PLAN / GROK-RUNBOOK 逐条施工
- 给 demo 绑回生产 D1
- 把 library token 打进前端包
- 再加一批主题/布局（除非用户点名）
