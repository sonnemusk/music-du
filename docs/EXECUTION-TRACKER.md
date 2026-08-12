# 执行追踪（本地）

> 本文件记录对齐结论、进度勾选与证据；已与 `main` 同步远端，供多 agent 共用。
> 配套：`OPTIMIZATION-PLAN.md`（施工细节）、`GROK-RUNBOOK.md`（逐条提示词）。
> 收尾时清理临时说明与过时勾选，避免残留噪音。

更新：2026-08-12（已 push `main` @ `bf3fd8e`）

---

## 对齐结论（覆盖原文档 A/B 犹豫）

### 部署
- push → GitHub → Cloudflare 自动部署（私有站 + demo 现有 CI/env）。
- 不默认要求手工 `wrangler deploy`；建 D1 / 绑 `database_id` 等 CI 外步骤可本地/API 完成，合 PR 前先问用户。

### P0-1 Demo 库（已锁定）
| 项 | 结论 |
|----|------|
| 方案 | 独立 D1 `music-du-demo`，**否** localOnly/不绑 D1 |
| 数据 | 从生产 `music-du-library` **全表一次性拷贝** |
| 写 | demo 仍只读，写路径 **403**（`LIBRARY_READONLY`） |
| 读 | **C2**：GET 返回 favorites 等；**剔除 `history` / `curIdx`** |
| 信号 | 单信号 `LIBRARY_READONLY=true`；**不做** `DEMO_MODE` 双门槛 |
| 生产 binding | **不动**；只改 `[env.demo]` 的 `database_id` / `database_name` |
| 同步 | 一次性拷贝，不做例行双向同步 |
| 线上生效 | 代码合入并部署后才生效；本地先改 + 本地 commit，**不 push** 除非授权 |

### 执行纪律
1. 一次只做一条主任务；一条一个 commit（P1-5/F-10 拆 a–f）。
2. 验收贴数字/证据；改完 `typecheck` + `test` 全绿；客户端再 `build`。
3. 禁改：`KeyboardShortcuts` 的 `defaultPrevented`；Worker `/api/stream` 302 不代理。
4. 不直接推 `main`、不 force push；推远程 / 开 PR 前先问用户。
5. 动数据模型 / 公开 API / 跨布局 → 先短方案再改。
6. 本文件每完成一项打勾并记证据。

### 前端样稿策略
- P0-1 与 M 样稿 **文件面不冲突**，可 worktree 并发。
- 样稿范围：M-1 + M-2 + M-3 简化（真实 CSS，390/320 × aurora/neon/midnight）。
- 样稿在独立分支/worktree；用户过目后再铺 M-4…。

### 搜索 IA（2026-08-12，已确认 · 方案 B）
- 手机：🔍 + SearchOverlay；桌面头搜不变；**不**绑主题切换。
- 设计稿 A/B 仍在 `docs/mockups/m2-search-compare.html`（A 不进运行时）。

### 顺序
**P0 → M（先样稿再逐条）→ P1 → F → Q**

---

## 进度表

| # | 编号 | 任务 | 状态 | 证据 / 备注 |
|---|---|---|---|---|
| 0 | — | 读文档 + 计划落地本 tracker | [x] | 2026-08-12 |
| 0b | — | 基线 typecheck/test/build | [x] | typecheck 绿；16 files / 88→89 tests（P0-1 后 +1）；未强制 build（无客户端改） |
| 1 | P0-1 | 独立 demo D1 + 全表拷贝 + C2 | [x] | 本地 commit，**未 push**；线上需合入部署后生效 |
| 1a | P0-1 | 建 `music-du-demo` D1 | [x] | uuid `b737232e-4c66-46f1-9d01-67a584bb131f` |
| 1b | P0-1 | 生产 → demo 全表拷贝 | [x] | export→import；favorites 579 / history 277 / revision 207 |
| 1c | P0-1 | `wrangler.toml` 只改 demo binding | [x] | 生产 id 未动；demo → music-du-demo |
| 1d | P0-1 | readonly GET 剔除 history/curIdx | [x] | `publicReadonlyLibraryData` + worker GET |
| 1e | P0-1 | 单测 + typecheck/test | [x] | site-mode C2 用例；89 tests 全绿 |
| 1f | P0-1 | 本地 commit（不 push） | [x] | 见 git log |
| — | M-样稿 | M-1/M-2/M-3 简化可视预览 | [x] | 分支 `wip/m-mobile-mock`（对照）；已合入 main 正式实现 |
| 2 | M-1 | immersive 移动端断点 | [x] | `8e86b1d`；390 imm cols=362px listW=362 trunc=0 |
| 3 | M-2 | 搜索 IA 方案 B（🔍+层） | [x] | `136bcac`；桌面头搜不变 |
| 4 | M-3 | 空闲播放器 / 迷你条 | [x] | data-idle + denser player + charts chips；390 rows≥8 / 320 rows≥4 |
| 5 | M-4 | 触控 44px | [x] | pointer:coarse 抬到 44px |
| 6 | M-5 | 输入框 16px | [x] | coarse 下 input ≥16px |
| 7 | M-6 | hover 态 | [x] | hover 包 fine pointer；active 反馈 |
| 8 | M-7 | 安全区 + dvh | [x] | 100dvh + safe-area padding |
| 9 | M-8 | 主题面板抽屉 | [x] | 底部抽屉 + 关闭 + layout chips |
| 10 | M-9 | 歌词全屏 | [x] | data-tab=lyrics 藏 NP，spacer 50% |
| 11 | M-10 | tab 标签 | [x] | 移动端强制全称 ≥2 字 |
| 12 | M-11 | 滑动手势 | [x] | 迷你条区域 + 阈值 + data-no-swipe |
| 13 | M-12 | 删 all-themes.css | [x] | 已删死文件 |
| 14 | P1-1 | history 单调 pos | [ ] | |
| 15 | P1-2 | PUT 一次 loadLib | [ ] | |
| 16 | P1-3 | DDL 记忆化 | [ ] | |
| 17 | P1-4 | history 分级节流 | [ ] | |
| 18a–f | P1-5 | 六个小口子 | [ ] | 分 6 轮 |
| 19 | F-1 | tick 重渲染 | [ ] | |
| 20 | F-2 | 列表 memo/虚拟化 | [ ] | |
| 21 | F-3 | 封面预热 | [ ] | |
| 22 | F-4 | 骨架/空态 | [ ] | |
| 23 | F-5 | 主题 IA | [ ] | |
| 24 | F-6 | i18n | [ ] | |
| 25 | F-7 | a11y | [ ] | |
| 26 | F-8 | SW 更新 | [ ] | |
| 27 | F-9 | 字体首屏 | [ ] | |
| 28a–f | F-10 | 六个交互细节 | [ ] | 分 6 轮 |
| 29 | Q-1 | 双后端对齐 | [ ] | |
| 30 | Q-2 | Node 鉴权 | [ ] | |
| 31 | Q-3 | 测试补齐 | [ ] | |
| 32 | Q-4 | lint/CI | [ ] | |
| — | 收尾 | 全量复测 | [ ] | |

状态记号：`[ ]` 未做 · `[~]` 进行中 · `[x]` 完成 · `[-]` 取消/跳过

---

## 并发规则

| 轨道 | 改动面 | 隔离 |
|------|--------|------|
| P0-1（主工作区） | `wrangler.toml`、`server/worker.ts`、`server/site-mode*`、`tests/*`、D1 API | 当前目录 |
| M 样稿（subagent） | `client/src/skins/**`、`layouts.css`、少量 layout 组件 | **git worktree**，分支 `wip/m-mobile-mock` |

合并前：先合 P0-1 commit，再 cherry-pick / merge 样稿；避免同时改同一文件。

---

## 发现但未修（只记不修）

（执行中追加）
