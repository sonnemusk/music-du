# 优化与修复计划（已关闭）

**状态：施工完毕，不要再按本文逐条改代码。**  
原文写于 2026-08-12，基线（49 主题、16 文件 / 88 测试、demo 与生产共 D1、`MUSIC_ACCESS_TOKEN`）已经全部过期。

当前事实、默认皮肤、主题/布局数量、鉴权模型和剩余可选项见 **[STATUS.md](./STATUS.md)**。  
2026-08-12 的勾选流水见 **[EXECUTION-TRACKER.md](./EXECUTION-TRACKER.md)**（已改成结案页）。  
旧的逐步提示词在 **[GROK-RUNBOOK.md](./GROK-RUNBOOK.md)**，**禁止再粘贴执行**。

---

## 原计划覆盖了什么（均已落地）

| 编号 | 原目标 | 现状 |
|------|--------|------|
| P0-1 | demo 与生产 D1 隔离 + 只读剥 history/curIdx | 独立 `music-du-demo`；`publicReadonlyLibraryData` |
| M-1…M-12 | 移动端断点、搜索方案 B、44px、安全区、主题抽屉、手势 | 已合入；搜索层后又补了底 inset / 焦点陷阱 / 草稿态 |
| P1-1…P1-5 | D1 写放大、ensureSchema、节流、host/health/错误 | Worker 稀疏写 + 一次 batch；revision 最后 bump |
| F-1…F-10 | tick、列表、封面、主题 IA、i18n、SW、字体 | 虚拟化已是真窗口；SW 按 build 戳名 + `SKIP_WAITING` |
| Q-1…Q-4 | 双后端、Node 门闩、测试、lint/CI | Node：`LIBRARY_TOKEN`（可选）、CORS、SSRF、`/import`、事务+revision |

2026-08-14 追加（不在原 32 条里，已在 `main`）：

- 搜索代数 + `queueTouched`；布局 `React.lazy`；长列表窗口渲染
- 手机音质入口；Worker import 2MB；resolve-cache DDL 记忆化
- QQ/酷狗原生解析；默认皮肤 `stage-dim`；10 套 listen-first 壳 + gallery

---

## 给下一个 agent

1. 先读 [STATUS.md](./STATUS.md) 和代码，不要读完本文就去「修 P0-1」。
2. 不要再加主题/布局，除非用户点名。
3. 私有站鉴权是 **Cloudflare Access**，不要把 token 打进 SPA。
4. 改完跑 `npm test && npm run typecheck && npm run lint && npm run build`。
