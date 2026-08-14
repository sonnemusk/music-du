# 优化与修复计划

面向自建部署（Cloudflare Worker + D1 + Cloudflare Access）的完整待办清单。
本文件是**给执行 agent 的施工说明书**：每一条都给出「现状（文件:行号 + 实测数据）→ 目标 → 改法 → 验收标准」。

编号规则：`P0` 隐私阻断项 · `P1` 后端成本与性能 · `M` 移动端 · `F` 前端交互与展示 · `Q` 工程质量。
建议执行顺序：**P0 → M → P1 → F → Q**（M 排在 P1 前面，因为它是当前用户体感最差的部分）。

---

## 0. 施工须知

### 0.1 基线（改动前已验证通过，不要让它们退化）

| 项 | 基线值 |
|---|---|
| `npm run typecheck` | 通过，无错误 |
| `npm test` | 16 个文件 / 88 个测试全通过 |
| `npm run build` | `dist/client/assets/*.js` 318 KB（gzip 100 KB）、`*.css` 26.6 KB（gzip 6 KB） |
| 主题数量 | 49（`side` 20 / `immersive` 21 / `compact` 8） |

每完成一条，必须重新跑 `npm run typecheck && npm test`；涉及 UI 的必须补一条移动视口回归测量（见 §0.3）。

### 0.2 部署事实（不要按 README 的双路径假设去改）

- 线上是 **Cloudflare Worker**（`server/worker.ts`）+ **D1** + **Workers Assets**，域名前面挂了 **Cloudflare Access**。
- `server/app.ts` + `server/node.ts`（Node/SQLite）那条路径**当前没有用于生产**，但仓库对外开源，别人会用，所以 `Q-2` 仍要修。
- 判定依据：`wrangler.toml:28` 的 `LIBRARY_TOKEN_REQUIRED_HOSTS` 含生产域名；线上请求返回 `302 → *.cloudflareaccess.com` 且带 `www-authenticate: Cloudflare-Access`。

### 0.3 移动端测量脚本（验收用，放 `/tmp` 即可，不要提交进仓库）

```bash
npm i -D playwright && npx playwright install chromium --with-deps
npm run dev            # 127.0.0.1:8787，上游 api.chksz.com，需 CHKSZ_APIKEY
node /tmp/audit.mjs    # 见 §附录 A
```

测量矩阵：视口 `390×844`（iPhone 12/13/14）与 `320×568`（小屏下限）× 三套布局各取一个代表主题
（`aurora`=side、`neon`=immersive、`midnight`=compact，通过 `localStorage["kazam.v2.skin"]` 预置）。

---

## P0 — 隐私阻断项（先做这一条，其他都可以等）

### P0-1 只读 demo 与生产共用同一个 D1，导致私人音乐库被公开读取

**现状**

- `wrangler.toml:39`（生产）与 `wrangler.toml:68`（`[env.demo]`）的 `database_id` 是**同一个** D1 数据库。
- `wrangler.toml:58` 给 demo 设了 `LIBRARY_READONLY = "true"`，而 `server/worker.ts:332-333` 的逻辑是「只读环境 → library 直接放行、不校验 token」：
  ```ts
  if (envReadonly(c.env)) return null;   // libraryUnauthorized()
  ```
- 于是 `GET /api/library` 在 demo 上无需任何鉴权返回生产库全量数据。实测线上 demo 返回 **579 条收藏 + 277 条播放历史 + revision**。
- demo 的 `workers_dev = true`（`wrangler.toml:48`），且 demo 地址写在公开 README 里，任何人可访问。
- 写操作目前是安全的（`worker.ts:1195`、`worker.ts:1266` 在鉴权前先判 readonly 返回 403），但这是**唯一**一道防线：一旦 `[env.demo.vars]` 的 `LIBRARY_READONLY` 被删掉或拼错，公开地址立刻变成生产数据的写入口。

**目标**：公开 demo 不再触碰生产数据，且不再依赖单个环境变量来保证。

**改法**（按优先级选一个，推荐 A）

- **A（推荐）独立 D1**：`wrangler d1 create music-du-demo`，把 `wrangler.toml:65-69` 的 `database_id` 换成新库，用少量示例曲目做 seed。
- **B 不给 demo 绑 D1**：整段删掉 `[[env.demo.d1_databases]]`。`worker.ts:842-852` 已有 `!c.env.MUSIC_DU_DB → 503 + localOnly:true` 的降级分支，客户端会退回 localStorage，demo 仍可正常演示。
- **C 兜底加固（无论选 A 还是 B 都要做）**：`envReadonly` 为真时，`/api/library` 只返回 `favorites`，且把 `history`、`curIdx` 从响应里剔除；同时给 `[env.demo]` 增加一个显式的 `DEMO_MODE = "true"`，让 readonly 判定需要两个信号同时成立，避免单点拼写错误。

**验收**

1. demo 域名 `GET /api/library` 不再包含生产库的任何条目（`favorites`/`history` 长度与生产不一致，或直接 503 `localOnly`）。
2. 生产域名 `GET /api/library`（带 Access + token）行为不变。
3. `npm test` 全通过；给 `worker.ts` 的 readonly 分支补一条单测：readonly 环境下响应不含 `history` 字段。

---

## M — 移动端（重头戏）

> 结论先行：**移动端不是"样式不够好看"，而是三套布局在手机上都拿不到可用的列表区**。
> 49 个主题里 21 个用 `immersive` 布局，而 `immersive` 在整个 CSS 里**没有任何移动端断点**。
> 全项目只有 4 个 `@media` 断点（`global.css:167/181/224` + `layouts.css:954`），其中只有 1 个是给布局用的（860px，只覆盖 side）。

### 实测数据（改动前，必须在改完后逐项复测）

| 指标 | 390×844 · side | 390×844 · immersive | 390×844 · compact | 320×568 |
|---|---|---|---|---|
| `.imm-stage` 计算值 | — | **`320px 30px`** | — | `320px 22px` |
| 列表容器宽度 | 366 | **30** | 390 | 22（imm）/ 296（side） |
| 列表容器高度 | 324 | 764 | 3245 | **29**（side） |
| 首行 `.track-row` 的 y | **815** | **2389** | **685** | 883 / 2389 / 702 |
| 完整可见的行数（共 40 行） | **0** | **0** | **2** | **0 / 0 / 0** |
| 前 8 行歌名被截断数 | 0 | **8** | 0 | 7（side）/ 8（imm） |
| `.skin-search input` 宽度 | **47** | **24** | **24** | **24** |
| 空闲播放器占高 | 402 | 764 | 301 | 429 |

### M-1 `immersive` 布局在手机上把列表压成 30px 竖条（影响 21/49 主题）

**现状**：`client/src/skins/layouts/layouts.css:1012-1018`
```css
.imm-stage {
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;   /* 无任何 media query */
}
```
390px 视口减去 `.imm-shell` 左右 padding（`layouts.css:1003`，共 28px）剩 362px，第一列吃满上限 320px，`1fr` 只剩 **30px**。截图里右侧是一条竖条，tab 文字被压成单字竖排（搜/热/列/心/史/词），40 行歌曲变成一列噪点。

**目标**：手机上 immersive 单列纵向堆叠，且默认让列表可见。

**改法**
1. 加断点（建议 `max-width: 860px`，与 side 的现有断点对齐）：
   ```css
   @media (max-width: 860px) {
     .imm-stage { grid-template-columns: 1fr; grid-template-rows: auto 1fr; }
     .imm-now   { padding: 12px 8px; gap: 10px; }
     .imm-sheet { min-height: 0; }
   }
   ```
2. 手机上 immersive 的 `.imm-now` 不要垂直居中撑满（`layouts.css:1019-1028` 的 `justify-content: center` + `flex:1`），改成 `flex: 0 0 auto`。
3. `.imm-bg`（`layouts.css:986-992`）用了 `blur(32px) saturate(1.25) + scale(1.08)`：移动端 GPU 上这是持续合成开销，加 `@media (max-width: 860px)` 降到 `blur(18px)` 并去掉 `scale`，或在 `prefers-reduced-motion` 时禁用。

**验收**：390 与 320 两个视口下 `.imm-sheet` 宽度 ≥ 视口宽度 − 32px；首行 `.track-row` 的 y < 视口高度；前 8 行歌名截断数 = 0。

### M-2 头部搜索：从「撑开常驻框」改为「窄屏按需出现」（影响全部 49 主题）

> **方案修订（2026-08-12）**：终态见 `docs/SEARCH-MOBILE-PLAN.md`。  
> 原「两行 head + 常驻 searchW≥60%」仅作中间态/样稿；**不再作为终态验收**。

**现状**：`layouts.css:30-37` 的 `.skin-head__main` 是 `flex-wrap: nowrap`，`.skin-brand` 与 `.skin-head__tools` 不收缩，`.skin-search` 被压到 24–47px。更关键的是：已有「搜索」tab，头部仍全局挂 `SearchBar`（`layouts/shared.tsx`），窄屏浏览热榜/库/词时搜索框常驻占位，与 M-3 抢垂直空间。

**目标**
- **≤720px**：默认头部 **无** 整行搜索框；仅在 `tab === "search"` 时于面板顶展示满宽输入（可选头部 🔍 一切入搜索并 focus）。
- **>720px**：可保留头部常驻 `SearchBar`（桌面效率）。

**改法**（摘要，细节以 SEARCH-MOBILE-PLAN 为准）
1. 窄屏：头内不展示 `SearchBar`；搜索 tab 面板顶部挂满宽 `SearchBar`。
2. 可选：头内 🔍 → `setTab("search")` + focus。
3. 仍做：手机收起 `.skin-brand__theme`；工具区合并（语言进主题面板）；`LocaleSwitcher` 独立类名。
4. **不要**把「第二行整宽常驻 search」当作终态。

**验收**（390 / 320）
1. 非搜索 tab：`.skin-head` 内无可见搜索 input。
2. 搜索 tab：input 宽 ≥ `innerWidth - 32`。
3. 热榜 tab 列表可见行数不因搜索行变差（配合 M-3，≥3）。
4. 桌面 1440：头部搜索仍可用。

### M-3 空闲状态下播放器吃掉半屏到全屏，列表在首屏之外

**现状**：三套布局都把 now-playing 当主角，即使没在播：side 402px（`layouts.css:961-974`）、immersive 764px、compact 301px。叠加头部与榜单元信息后，首行歌曲的 y 分别是 815 / 2389 / 685（视口 844）。320×568 下 side 的列表容器高度只有 **29px**。

**目标**：手机首屏至少露出 3 行歌曲。

**改法**
1. 未播放时（`curTrack == null`）给 `.skin-host` 挂 `data-idle="1"`，手机上把封面占位从 `min(140px, 38vw)`（`layouts.css:971-974`）压到 72px 或直接隐藏，`.np-badges`、音量行（`layouts.css:876-884`）一并隐藏。
2. 播放中：手机上把 now-playing 折叠成**底部迷你条**（封面 40px + 标题 + 播放/下一首），完整播放器改为点击迷你条上滑展开的全屏面板。compact 已经有 `.player-bar` 结构（`layouts/CompactLayout.tsx:12-17`），可作为三套布局共用的移动端形态。
3. 榜单元信息在手机上折叠：`.charts-desc` / `.charts-source` / `.charts-hint` / `.charts-updated`（`layouts.css:356-377`）默认收起，只留标题 + 刷新；平台/榜单 chips（`layouts.css:378-406`）由 `flex-wrap: wrap`（现在手机上占 3 行）改成单行横向滚动 `overflow-x: auto; scroll-snap-type: x mandatory`。

**验收**：390 和 320 视口下，`热榜` tab 首屏 `rowsFullyVisible ≥ 3`；首行 y < 视口高度 − 120。

### M-4 触控目标普遍小于 44px

**现状**（390 实测，按 iOS HIG 44×44 与 WCAG 2.5.5 判定）

| 元素 | 实测 | 位置 |
|---|---|---|
| `.skin-tabs button` | 46×34 / 33×34（短标签） | `layouts.css:138-147` |
| `.t-btn.ghost`（随机/沉浸/收藏） | 75×36、50×36、35×32 | `layouts.css:571-596` |
| `.skin-switcher__btn` | 40×34 ~ 54×34 | `global.css:181-191` |
| `.icon-btn`（列表行删除/收藏） | 36×36 | `layouts.css:439-447` |
| `.charts-chip` / `.charts-refresh` | min-height 32 | `layouts.css:342-400` |
| 进度条 `input[type=range]` | 244×28 | `layouts.css:822-836` |
| 音量条 | 237×28 | `layouts.css:892-898` |

**改法**：加 `@media (pointer: coarse)` 分支统一抬高到 44px（视觉尺寸可保持，用 `::before` 扩大命中区或 `padding` + 负 margin）；进度条与音量条把轨道高度提到 44px 命中区、拇指 `16px`，并加 `touch-action: none` 防止拖动时页面跟着滚。

**验收**：审计脚本在 `pointer: coarse` 上下文里输出的「小于 44px 的可交互元素」列表为空（进度/音量条按命中区计算）。

### M-5 输入框字号 < 16px，iOS 聚焦时整页缩放

**现状**：`.skin-search input` 14px（`layouts.css:78-90`）、`.skin-panel__search` 13px（`global.css:199-209`）、range 11px。Safari iOS 对 `font-size < 16px` 的输入框聚焦会自动放大页面，放大后不会自动还原，用户会觉得"界面乱了"。

**改法**：`@media (pointer: coarse)` 下所有 `input` 的 `font-size: 16px`（视觉上可用 `transform: scale()` 或调整 padding 保持比例）。

**验收**：移动视口下 `document.querySelectorAll("input")` 的 `computedStyle.fontSize` 全部 ≥ 16px。

### M-6 触摸设备残留 hover 态

**现状**：全项目 `@media (hover:` 出现 **0 次**；`:hover` 规则 11 处（`layouts.css` 6 / `refined-base.css` 4 / `global.css` 1），例如 `.skin-card:hover{transform:translateY(-1px)}`、`.badge-btn:hover{filter:brightness(1.08)}`、`.lyrics-panel .ly:hover`。实测轻点后 `:hover` 链仍挂在 `.imm-now` / `.player-bar` 上不释放，表现为"点过的地方一直亮着"。

**改法**：所有 `:hover` 规则包进 `@media (hover: hover) and (pointer: fine)`；触摸端改用 `:active` 提供按压反馈。

**验收**：移动视口轻点后 `document.querySelectorAll(":hover")` 不含卡片/歌词/徽标类元素。

### M-7 安全区与动态视口高度

**现状**：`global.css:1-5` 定义了 `--safe-b`/`--safe-t`，但 `--safe-b` 全项目只被 `.toast`（`global.css:284`）使用；底部控件（音量行、compact 播放条）没有底部安全区内边距，iPhone 上会压在 home indicator 下面。全项目 `dvh`/`svh`/`lvh` 出现 **0 次**，`html,body,#root { height: 100% }`（`global.css:34-39`）在 iOS 工具栏收放时会跳动。

**改法**：底部容器加 `padding-bottom: max(12px, env(safe-area-inset-bottom))`；`.app-shell` 高度改 `height: 100dvh`（保留 `100%` 作为回退）；`layouts.css:22` 顶部安全区已处理，保持。

**验收**：390×844 且模拟 `env(safe-area-inset-bottom: 34px)` 时，底部最后一个可交互元素的 `bottom` ≤ 视口高度 − 34。

### M-8 主题面板在手机上要滚 7 屏

**现状**：`global.css:224-228` 在 `max-width: 420px` 下把 `.skin-panel__grid` 改成单列；实测面板 366×520 而内容 `scrollHeight = 3809`（49 张 340×68 卡片）→ 约 **7 屏**滚动，没有分组、没有关闭按钮（`SkinSwitcher.tsx:60-129` 只能点外面关），面板锚在头部（`SkinSwitcher.tsx:70-82`）只用了屏幕上 2/3。

**改法**
1. 手机上改为**底部抽屉**：`position: fixed; inset: auto 0 0 0; max-height: 85dvh; border-radius: 16px 16px 0 0`，带顶部拖拽条与显式关闭按钮。
2. 按 `layout` 分组（侧栏 / 沉浸 / 紧凑）+ 可折叠分区，或加一行 layout 过滤 chips；卡片改 2 列紧凑网格（每张只留色板 + 名称，`tagline` 收进次要行）。
3. 面板筛选框补 `type="search"` + `enterkeyhint`，字号 16px（见 M-5）。
4. `role="dialog"` 补 `aria-modal="true"`、打开时聚焦筛选框、关闭后焦点还原、Tab 焦点锁在面板内。
5. 外部关闭现在只监听 `mousedown`（`App.tsx:81-92`），补 `touchstart`/`pointerdown` 并在 `Escape` 已支持的基础上保持一致。

**验收**：390 视口下选中任意一个主题所需滚动距离 ≤ 1 屏；面板可通过显式按钮关闭；键盘 Tab 不会跑到面板外。

### M-9 歌词在手机上只占 1/4 屏且未居中

**现状**：390 视口实测 `.lyrics-scroller` 高度：side **209**px（占 25%）、compact 391px、immersive 492px；当前高亮行的 y 分别是 687 / 625 / 396，前两者贴在底部而不是视觉中心。`.lyrics-spacer` 用 `min(28vh, 160px)`（`layouts.css:480-484`），在矮视口里不足以把首行推到中间。

**改法**：手机上歌词 tab 进入**全屏模式**（隐藏 now-playing 大区块，只留迷你条）；spacer 改成基于滚动容器实际高度的 `50%`（用 JS 读高度或 `calc(50% - 1em)`）；`LyricsView` 的居中滚动改用 `scrollIntoView({ block: "center" })` 的等效计算并跳过用户手动滚动后的 3 秒。

**验收**：390 视口歌词 tab 下 `.lyrics-scroller` 高度 ≥ 视口 60%；高亮行中心与容器中心偏差 ≤ 40px。

### M-10 单字 tab 标签可读性差

**现状**：compact 布局用 `tabs="short"`（`CompactLayout.tsx:10`），手机上渲染成「搜 热 列 心 史 词」；immersive 被 30px 竖条压成竖排单字。

**改法**：移动端 tab 改为 `图标 + 短词`（如 `♥ 喜欢`）的横向滚动条，或底部 tab bar（更符合手机习惯，且能顺带解决 M-3 的空间问题）。至少要保证 2 字词而不是 1 字。

**验收**：移动视口下每个 tab 的可见文本长度 ≥ 2 个字符，且 tab 行不换行（横向可滚）。

### M-11 全屏滑动手势与列表滚动冲突

**现状**：`App.tsx:60-67` 把 `attachSwipeNav` 挂在整个 `.app-shell` 上（`lib/swipe-nav.ts`），左右滑 = 上/下一首。手机上横向滑动出现在很多地方（chips 横滚、歌词、误触），全屏级手势容易误触发切歌。

**改法**：把手势范围收窄到 now-playing / 迷你条区域；提高触发阈值（水平位移 > 60px 且 `|dx| > 2|dy|`）；在横向可滚容器上标 `data-no-swipe` 并在处理器里跳过。

**验收**：在榜单列表纵向滚动、chips 横向滚动时不触发切歌；在迷你条上横滑正常切歌。

### M-12 死文件里的移动端样式

**现状**：`client/src/skins/themes/all-themes.css`（769 行 / 17.8 KB）全项目无任何 import，里面还有两处 `@media (max-width: 800px)`（`:332`、`:699`）——历史上的移动端适配写在了不生效的文件里。

**改法**：确认无用后删除；若其中有值得保留的移动端规则，迁进 `layouts.css` 的新断点。

**验收**：`rg "all-themes" client/` 无结果；构建产物 CSS 体积不增加。

---

## P1 — 后端成本与性能（Worker + D1）

### P1-1 每播一首歌重写整张 history 表（约 200 行写入）

**现状**
- 客户端 history 上限 200（`client/src/store/player.ts:1179-1182`），每次 `playTrack` 把新歌 prepend 到队首并触发 `persistSoon`（`player.ts:1186`）。
- 服务端 `saveLib` 已能跳过未变化的列表（`worker.ts:253-266`），但 history 每首歌都变。
- history 按位置存储（`library_tracks.pos`），prepend 使所有行 `pos` 位移，`writeList`（`worker.ts:187-238`）因此对全部约 200 行执行 `INSERT OR REPLACE`，外加 1 次 `DELETE ... WHERE updated_at < ?` 与 1 次 revision 写。
- 影响：D1 免费额度 10 万写/天 → 约 **500 首/天**触顶；PUT 延迟被 3 批 batch 拖长。

**目标**：单次播放的 D1 行写入从约 200 降到 1–2，且不需要数据迁移。

**改法（免迁移）**：把 history 的 `pos` 当作**单调递减序号**而不是稠密下标。
1. `loadLib`（`worker.ts:154-180`）已是 `ORDER BY pos ASC`，读取侧无需改。
2. 新增 history 专用写入路径：读现有 `sid → pos` 映射，客户端传来的 id 中**已存在的保留原 pos**，新 id 分配 `min(pos) - 1`（允许负数），只对新增/变化的行写；超出上限的按 `pos DESC` 删除尾部。
3. `playlist` / `favorites` 保持现有 `writeList`（它们是用户显式排序，稠密 pos 有意义）。

**验收**：给 `library-merge.ts` 补纯函数单测：给定 200 条现有 history + 1 条新歌，规划出的写语句数 ≤ 3；连播 10 首后 `GET /api/library` 的 history 顺序与客户端一致。

### P1-2 一次 PUT 读了三遍全库

**现状**：`worker.ts:1205` 调 `loadLib`，`saveLib` 内部又在 `worker.ts:255`（取 existing 比对）和 `worker.ts:272`（返回值）各调一次。每次 `loadLib` 扫 3 张列表（实测约 856 行）→ 单次 PUT 约 **2500 行读**。

**改法**：`saveLib` 增加 `existing` 入参，由调用方传入已读到的快照；返回值用本地已算好的 `{playlist, favorites, history, curIdx, revision}` 组装，不再 `loadLib`。保留一个 `?verify=1` 的调试开关走原路径。

**验收**：单次 PUT 的 `loadLib` 调用次数 = 1（加临时计数日志或单测断言）；`tests/library-merge.test.ts` 原有断言不变。

### P1-3 每个 library/song 请求都跑一遍建表 DDL

**现状**：`ensureSchema`（`worker.ts:98-110`）= `ensureResolveCacheSchema`（2 条 DDL，`resolve-cache.ts:24-44`）+ 2 条 `CREATE TABLE IF NOT EXISTS`，被 `loadLib:155`、`saveLib:241`、`deleteSid:281` 各自调用；`ensureResolveCacheSchema` 还在 `worker.ts:507/550/603/661/751` 独立调用。叠加 P1-2，一次 PUT 累计约 16 条 DDL。

**改法**：isolate 级记忆化——模块作用域 `let schemaReady: Promise<void> | null = null`，`ensureSchema` 首次调用建 Promise 后复用；失败时置回 `null` 允许重试。

**验收**：同一 isolate 内连续 5 次 `GET /api/library` 只执行一次 DDL（单测用 mock D1 统计 `prepare` 调用）。

### P1-4 客户端 history 落库节流过激进

**现状**：`persistSoon` 固定 500ms 防抖（`player.ts:2388-2397`），`flushLibrarySave`（`player.ts:2399-2461`）每次 PUT **整库**，实测 payload **171 KB**（gzip 64 KB）。连续切歌 = 连续大 PUT。

**改法**
1. 分级节流：收藏/队列等显式操作保持 500ms；history/curIdx 走 15–30s 的慢通道，并在 `visibilitychange`/`pagehide` 时强制 flush。
2. localStorage 镜像（`player.ts:2420`）从 `flushLibrarySave` 里**提前**到状态变更时立即写，避免慢通道导致关页丢历史。
3. 可选：PUT 只带变化的列表（服务端 `mergeTrackList` 已支持缺省列表不覆盖，见 `library-merge.ts:52`）。

**验收**：连续切 10 首歌产生的 `PUT /api/library` 次数 ≤ 2；刷新页面后本地 history 不丢。

### P1-5 其他 Worker 侧小项

| 编号 | 现状 | 改法 |
|---|---|---|
| P1-5a | `wrangler.toml:13` `compatibility_date = "2025-01-01"`（落后约 19 个月） | 升到近期日期，跑一遍 smoke |
| P1-5b | `worker.ts:345` `host.endsWith(h)` 无点边界，`dubin.cc` 会匹配 `xxdubin.cc` | 只保留 `host === h \|\| host.endsWith("." + h)` |
| P1-5c | `worker.ts:398-399` `/api/health` 公开返回上游 `api_base`/`fallback_base` | 去掉，或仅在带 token 时返回 |
| P1-5d | `library-merge.ts:113-117` token 用 `===` 比较；`worker.ts:361-372` 还接受 `?token=` 与 cookie | 改成等长常量时间比较；query 方式标记 deprecated |
| P1-5e | 各 handler 把 `e?.message` 原样返回给客户端（如 `worker.ts:434-435`） | 对外返回通用文案，细节只进日志 |
| P1-5f | `resolve-cache` 的 `pruneResolveCache`（`resolve-cache.ts:153-182`）设计良好但只在两处触发（`worker.ts:565/676`） | 保持，确认 `waitUntil` 覆盖主要路径即可 |

---

## F — 前端交互与展示

> 先明确一点：**打包体积不是瓶颈**（318 KB / gzip 100 KB，其中 `theme-catalog.ts` 只占 28 KB raw / 6.6 KB gzip ≈ 7%）。
> 真正的成本在高频重渲染、被抵消的懒加载、以及首屏字体。不要把力气花在拆 chunk 上。

### F-1 播放中每秒 4–10 次全组件重渲染

**现状**：`tick()`（`player.ts:1837-1854`）在每个 `timeupdate` 更新 `currentTime`/`duration`/`buffered`/`playing`/`lyricIdx`；`Transport.tsx` 挂了 **21** 个 `usePlayer` 选择器、`TrackList.tsx` **12** 个、`MediaSession.tsx` 订阅 `currentTime` 导致每 tick 重跑 effect（`MediaSession.tsx:15-18,204`）。

**改法**
1. 把时间类状态从主 store 拆到独立的轻量 store（或 `useSyncExternalStore` + ref），只让进度条与时间文本订阅。
2 . 进度填充用 CSS 变量（`--seek-play`/`--seek-buf` 已存在，`layouts.css:747-758`）直接写 DOM style，不走 React 状态。
3. `MediaSession` 的 `setPositionState` 节流到 1Hz，或改从 `audio` 元素读。
4. `lyricIdx` 只在 `tick()` 算一次，删掉 `LyricsView.tsx:116-124` 的重复计算。

**验收**：React DevTools Profiler 下播放中 1 秒内 `TrackList` 与 `SkinHead` 的 commit 次数为 0；进度条仍平滑。

### F-2 长列表无虚拟化、行无 memo

**现状**：`TrackList.tsx:212-332` 直接 `tracks.map`，579 条收藏 = 579 个 DOM 行 × 每行 1 张封面；`curTrack`/`loadingPlay`/`locateRequest` 任一变化即整列表重渲染；行内 `ref` 回调每次渲染都重建（`TrackList.tsx:218-222`）。

**改法**：抽出 `memo` 化的 `TrackRow`，行内只订阅 `active`/`loading` 两个布尔量；列表超过约 100 项时上虚拟滚动（`@tanstack/react-virtual` 或自写窗口）；`ref` 回调用 `useCallback` 稳定化。

**验收**：579 项收藏列表首次渲染 < 200ms（Performance 面板）；切歌时只有 2 行发生 commit。

### F-3 封面预热把 `loading="lazy"` 完全抵消

**现状**：`CoverImg.tsx:72` 正确用了 `loading="lazy"`，但 `CoverImg.tsx:56-60` 的 `useEffect` 对**每一个渲染出来的行**调 `warmCoverFromRemote`，而它会（a）`new Image()` 立即请求直连 CDN（`cover-browser-cache.ts:63-72`，绕过懒加载），（b）`fetch` 一次同源 `/api/cover-proxy` 并写入 Cache Storage（`:73`）。579 行 ≈ **1158 个请求**，且 `kazam-covers-v3` 这个 Cache Storage 没有任何容量上限或淘汰。

**改法**：`CoverImg` 去掉逐行预热，改由列表容器用 `IntersectionObserver` 只预热进入视口附近的项（`warmTrackCovers`（`cover-browser-cache.ts:77-87`）已有 40 条上限与错峰逻辑，复用它）；给 Cache Storage 加条数上限与 LRU 清理；移动网络（`navigator.connection.saveData` 或 `effectiveType` 含 `2g`）下只走直连不写 Cache。

**验收**：打开 579 项收藏列表，Network 面板首屏请求数 < 60；滚动后按需增长。

### F-4 加载与空态过于朴素

**现状**：加载态靠 `.track-row.loading` 的 CSS 伪元素追加文案（`global.css:262-271`），而且**文案硬编码中文** `content: " · 加载中"`；`.empty`（`layouts.css:524-530`）只有一行灰字；歌词空态不区分"加载中 / 无歌词 / 加载失败"（`LyricsView.tsx:194-204`）。

**改法**：列表/榜单加载用骨架屏（重复 6 行灰块，尊重 `prefers-reduced-motion`，`global.css:341-346` 已有该媒体查询）；把伪元素文案改为 React 渲染 + i18n；歌词与列表空态区分三种状态并给出可操作按钮（重试 / 去搜索）。

**验收**：切换 tab 时不出现"白屏 → 突然满屏"；`rg "加载中" client/src/styles` 无结果。

### F-5 主题选择的信息架构

**现状**：49 个主题平铺（`SkinSwitcher.tsx:95-124`），只能靠名字/tagline 文本过滤；卡片只有一条 4px 色板（`global.css:245-251`），选之前看不出布局差异；主题名与 tagline 全是中文硬编码（`theme-catalog.ts`，49 × 2 条），英文界面下仍显示中文。头部那个视觉最重的 `primary` 按钮其实是「随机切换」（`SkinSwitcher.tsx:146-154`），比"打开主题列表"更抢眼。

**改法**：卡片加迷你布局缩略图（三个 div 拼出 side/immersive/compact 的形态）+ 主色/强调色双色块；按布局分组或加 layout 过滤；给 `ThemeTokens` 增加 `nameEn`/`taglineEn`（或 i18n key）并在英文下使用；头部主次调换（主题列表为主按钮，随机切换降为次要图标）。

**验收**：英文界面下主题面板无中文；从打开面板到选中目标主题的滚动距离 ≤ 1 屏（与 M-8 合并验收）。

### F-6 i18n 漏网的硬编码文案

**现状**：`Transport.tsx:190` 音量 `aria-label="音量"`；`global.css:267` `" · 加载中"`；`ChartsPanel.tsx:13-20` 的 `FALLBACK_PLATFORMS` 平台名（抖音/网易云…）；`player.ts:479-481` 默认榜单名与描述；`server/app.ts:60` 的 `note` 字段中文直出到 API；`theme-catalog.ts` 全部主题名/tagline。

**改法**：全部走 `i18n`；`tests/i18n.test.ts` 增加一条键值对齐检查（`en.ts` 与 `zh.ts` 结构一致，当前 199/200 行结构已对齐，加测试防回归）；再加一条 lint 式测试：`client/src/components` 与 `client/src/store` 下不允许出现连续 2 个以上 CJK 字符的字面量（白名单除外）。

**验收**：切到英文后通篇无中文（主题名除外可先保留 id）；新增测试通过。

### F-7 可访问性

**现状**：`TrackList.tsx:224-233` 播放中行只有 `playing` class，无 `aria-current`；`role="button"` 的行没有 `aria-pressed`/`aria-label` 说明；主题面板无 `aria-modal`、无焦点管理（`SkinSwitcher.tsx:63-66`）；进度条与音量 `input[type=range]` 缺 `aria-valuetext`（现在读屏读出的是秒数原值）；`Toast`（`components/Toast.tsx`）需确认有 `role="status"` + `aria-live="polite"`。

**改法**：逐项补齐；键盘可达性已有基础（`KeyboardShortcuts.tsx:29` 用 `defaultPrevented` 正确避开了行内 Space 冲突，这块**不要动**）。

**验收**：Lighthouse Accessibility ≥ 95；键盘可完成「搜索 → 播放 → 收藏 → 切主题」全流程。

### F-8 Service Worker 更新流程

**现状**：`client/public/sw.js:2` 缓存名固定 `music-shell-v1`，`activate` 只删**其他**名字的缓存（`:11-17`），所以历次部署的哈希资源在同一缓存里无限堆积；`main.tsx:13-18` 注册后调 `skipWaiting` 但没监听 `controllerchange`，用户可能停留在 HTML 与 JS 版本不匹配的状态。

**改法**：缓存名带构建版本（`import.meta.env` 注入或构建时替换）；`activate` 清理旧版本；主线程监听 `controllerchange` 后 `location.reload()` 一次（加 `sessionStorage` 标记防循环），或弹出"有新版本，点击刷新"的 toast。

**验收**：连续两次构建部署后，Cache Storage 中只保留当前版本条目；新版本上线后一次刷新即生效。

### F-9 首屏字体（对国内访问影响最大的一条）

**现状**：`client/index.html:17-20` 用一个**阻塞样式表**从 `fonts.googleapis.com` 加载 **9 个字族**（Bebas Neue / DM Sans / IBM Plex Mono / Instrument Serif / JetBrains Mono / Outfit / Playfair Display / Space Grotesk / Syne）。这 9 个确实被 49 个主题分别引用，但任一时刻只有当前主题的 1–2 个有用。`fonts.googleapis.com` 在国内不可达，浏览器会为待定 CSS 阻塞渲染直到超时。字体栈里有 `"PingFang SC", system-ui` 兜底（`global.css:42`），所以最终能显示，只是白等。

**改法**：首屏只加载基础字族（DM Sans）或干脆全部走系统字体；其余字族在主题切换时动态注入 `<link>`（`SkinHost` 里按 `meta.font` 解析需要的字族）；更彻底的做法是自托管 woff2 子集走自己的域名（同域 + 走 Access，顺带绕开可达性问题）。无论哪种，`<link>` 都加 `media="print" onload="this.media='all'"` 之类的非阻塞加载方式。

**验收**：断开 `fonts.googleapis.com`（hosts 屏蔽）后首屏内容渲染时间与联通时相差 < 200ms；主题切换后对应字族在 1s 内生效。

### F-10 交互细节补齐

| 编号 | 现状 | 改法 |
|---|---|---|
| F-10a | 搜索无历史、无建议、无"清空"按钮（`SearchBar.tsx` 47 行） | 加最近搜索（localStorage，上限 10）与一键清空 |
| F-10b | 列表行操作按钮常显（`TrackList.tsx:263-274`），手机上挤压歌名 | 桌面 hover 显示，移动端改左滑操作或长按菜单 |
| F-10c | 播放失败提示区分不足（`player.ts:1433-1437,1464-1478` 两种 toast） | 区分「自动播放被拦截（需手势）」「网络失败（可重试）」「无版权/无源」三类，并给重试按钮 |
| F-10d | 音质菜单 `.quality-menu` 用 `translateX(-50%)` + `max-width: min(18rem, 80vw)`（`layouts.css:617-638`），靠近屏幕边缘可能溢出 | 加边界检测或改用 `position: fixed` 的锚定弹层 |
| F-10e | 无"正在播放"全局可见性：切到其他 tab 后只能靠迷你条 | 与 M-3 的迷你条一并解决 |
| F-10f | `client/src/lib/*-cache.ts` 五个文件各自实现 TTL/LRU/localStorage（`song-cache` / `lyric-cache` / `chart-cache` / `cover-browser-cache` / `audio-cache`） | 抽 `lib/cache-store.ts` 泛型实现，各自只声明 key/ttl/max |

---

## Q — 工程质量（不阻塞体验，但影响后续改动安全性）

### Q-1 双份后端实现导致行为漂移

`server/worker.ts`（1335 行）与 `server/app.ts`（330 行）把 search / charts / song / qualities / lyric / stream / cover-proxy / library / favs 各实现了一遍，已出现漂移：

| 路由 | Worker | Node |
|---|---|---|
| `/api/song/:sid` | D1 resolve 缓存 + 边缘缓存（`worker.ts:582-699`） | 无缓存，但支持 `?qualities=1` 内联探测（`app.ts:114-125`，最多 8 次上游调用） |
| `/api/stream/:sid` | 302 跳转 CDN（`worker.ts:743-804`） | 全字节代理 + Range（`app.ts:179-204`），且 `fetch` 无超时（`app.ts:194`） |
| `/api/cover-proxy` 失败 | 502（`worker.ts:833-834`） | 404（`app.ts:247-251`） |
| charts 强制刷新 | 只认 `force`（`worker.ts:455`） | 认 `force` 与 `refresh`（`app.ts:79`） |

**改法**：抽共享路由工厂，缓存与存储通过适配器注入（edge cache / 磁盘、D1 / SQLite）；短期至少把上表 4 项对齐并补测。

### Q-2 Node 路径的 library 接口无鉴权，且与文档不符

`app.ts:255`（GET）、`:294`（PUT）、`:308`（DELETE）、`:291-292`（`/favs`、`/export`）都没有 `MUSIC_ACCESS_TOKEN` 或 `LIBRARY_READONLY` 检查（这些只存在于 `worker.ts:328-378`），但 `README.md:108` 与 `docs/API.md` 声称 token 会保护 library API。另：`README.md:128` 写的 `/import` 只在 Worker 里存在。

**改法**：把 `libraryUnauthorized` / `isLibraryReadonly` 提到共享模块并在 `createApp` 里应用；`node.ts:28-33` 的 `readBody` 加请求体上限（1–2 MB → 413）；`node.ts:71-72` 的 `response.arrayBuffer()` 改流式 pipe（现在会把整首歌缓冲进内存）；`node.ts:155-162` 补 SIGTERM/SIGINT 优雅退出；`app.ts:25` 的 `cors()` 收紧到已知来源。文档同步修正。

### Q-3 测试覆盖缺口正好在生产代码上

现有 16 个测试文件覆盖的是纯函数与 Node 侧；**零测试**的是：`server/worker.ts`（线上真正跑的 1335 行）、`server/node.ts`、`resolve-cache.ts`、`edge-cache.ts`、`cover-cache.ts`、`cover-fetch.ts`、`charts-disk.ts`、`config.ts`，以及全部 React 组件（`store/player.ts` 只有 `hardStopAudio` 被覆盖）。

**改法**：优先给 `worker.ts` 加集成测试（用 `unstable_dev` 或 mock `Env` + mock D1），覆盖 library 鉴权矩阵（readonly / 有 token / 无 token / 缺 D1）、revision 冲突、P1-1 的 history 写入规划；给 `TrackList`/`Transport` 加 React Testing Library 冒烟测试。

### Q-4 缺少 lint / 依赖治理 / PR 构建

- 全仓库没有 ESLint / Prettier / Biome 配置。
- 没有 `.github/dependabot.yml`，没有 CodeQL。
- `.github/workflows/ci.yml:31-32` 的 test job 只跑 `typecheck` + `test`，**不跑 `npm run build`**（客户端打包在 PR 上完全没验证）；`scripts/smoke.ts` 从未接入 CI。
- `package.json:26` 的 `@hono/node-server` 是 dependency 但代码从未 import；`package-lock.json` 根 `name` 仍是旧项目名 `kazam`。
- `Dockerfile` 以 root 运行、无 `HEALTHCHECK`、基础镜像用浮动 tag。

**改法**：按上述逐项补；lint 规则从宽开始（`no-unused-vars`、`react-hooks/*`、`import/order`），避免一次性产生上千条报错。

---

## 附录 A — 移动端审计脚本（验收基线）

放 `/tmp/audit.mjs`，需要在仓库根执行（`node /tmp/../workspace/...` 或把文件放进仓库根后运行，注意**不要提交**）。

```js
import { chromium } from "playwright";
const CASES = [["aurora","side"],["neon","immersive"],["midnight","compact"]];
const VPS = [{n:"390",width:390,height:844},{n:"320",width:320,height:568}];
const b = await chromium.launch();
for (const vp of VPS) for (const [skin,layout] of CASES) {
  const ctx = await b.newContext({ viewport:{width:vp.width,height:vp.height},
    deviceScaleFactor:2, isMobile:true, hasTouch:true });
  const p = await ctx.newPage();
  await p.addInitScript(s => localStorage.setItem("kazam.v2.skin", s), skin);
  await p.goto("http://127.0.0.1:8787");
  await p.waitForTimeout(1200);
  await p.locator(".skin-tabs button").nth(1).tap();          // 热榜
  await p.waitForSelector(".track-row", { timeout: 30000 }).catch(()=>{});
  await p.waitForTimeout(1500);
  console.log(vp.n, layout, await p.evaluate(() => {
    const rows=[...document.querySelectorAll(".track-row")];
    const host=document.querySelector(".imm-sheet,.side-panel,.compact-main");
    const small=[...document.querySelectorAll("button,input,[role=button]")]
      .filter(e=>{const r=e.getBoundingClientRect();
        return r.width&&r.height&&(r.height<44||r.width<44);}).length;
    return {
      listW: host && Math.round(host.getBoundingClientRect().width),
      firstRowY: rows[0] && Math.round(rows[0].getBoundingClientRect().top),
      rowsVisible: rows.filter(e=>{const r=e.getBoundingClientRect();
        return r.top>=0 && r.bottom<=innerHeight;}).length,
      searchW: Math.round(document.querySelector(".skin-search input")
        ?.getBoundingClientRect().width || 0),
      smallTargets: small,
      immCols: document.querySelector(".imm-stage") &&
        getComputedStyle(document.querySelector(".imm-stage")).gridTemplateColumns,
      inputFonts: [...document.querySelectorAll("input")]
        .map(e=>getComputedStyle(e).fontSize),
    };
  }));
  await ctx.close();
}
await b.close();
```

### 移动端验收目标值

| 指标 | 现状（390/320） | 目标 |
|---|---|---|
| `immCols` | `320px 30px` / `320px 22px` | 单列（`1fr`） |
| `listW` | 30 / 22（immersive） | ≥ 视口宽 − 32 |
| `firstRowY` | 815 / 2389 / 685 | < 视口高 − 120 |
| `rowsVisible` | 0 / 0 / 2 | ≥ 3 |
| `searchW` | 24–47 | ≥ 0.6 × 视口宽 |
| `smallTargets` | 12–13 类 | 0 |
| `inputFonts` | 11px / 13px / 14px | 全部 ≥ 16px |
