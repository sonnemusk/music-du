# 执行手册（逐条提示词）

配套文档：[OPTIMIZATION-PLAN.md](./OPTIMIZATION-PLAN.md)（每条任务的现状/目标/改法/验收标准都在那里）。

本文件是**给人用的操作台**：一条任务一段现成提示词，复制 → 发给执行 agent → 它做完汇报 → 你在下面的进度表打勾 → 再发下一条。
不要一次性把多条丢给它，也不要跳过验收。

共 **32** 条：`P0` ×1 · `M` ×12 · `P1` ×5 · `F` ×10 · `Q` ×4。

---

## 通用约束（每段提示词都会引用这一节，不用重复粘贴）

1. **一次只做一条**，本轮编号之外的任何文件改动都不要做，看到别的问题只记录不修。
2. **不要碰这两处**（已确认是正确设计，不是 bug）：
   - `client/src/components/KeyboardShortcuts.tsx:29` 的 `if (e.defaultPrevented) return;` 守卫——它正是列表行空格键不冲突的原因。
   - `server/worker.ts:743-804` 的 `/api/stream` 302 跳转——浏览器会带 `Range` 重发到最终地址，拖动进度正常，这是刻意的免流量设计。
3. **基线不能退化**：改完必须 `npm run typecheck && npm test` 全绿（基线 16 个文件 / 88 个测试）。涉及客户端的再跑一次 `npm run build`。
4. **验收要贴数字**，不要只说"改好了"。移动端任务按 `OPTIMIZATION-PLAN.md` 附录 A 的脚本复测，把该条目「验收」里要求的指标实测值贴出来。
5. **一条任务一个 commit**，message 带编号，例如 `fix(mobile): M-1 collapse immersive grid on phones`。
6. 改动只在当前工作分支上进行，不要直接推 `main`，不要 force push，不要合并 PR。
7. 拿不准的地方**先问再改**，尤其是会改变数据库结构、公开接口返回值、或主题视觉风格的改动。

### 环境准备（第一次执行前做一次）

```bash
npm ci
npm run dev                                   # 127.0.0.1:8787，上游 api.chksz.top 免 key 可直连
npm i -D playwright && npx playwright install chromium --with-deps   # 移动端验收用
```

> 审计脚本放 `/tmp` 或仓库根，但**不要提交**；`playwright` 也不要提交进 `package.json`（验收完 `git checkout package.json package-lock.json`）。

---

## 第 0 步：开场（只发一次）

```
你是 music-du 这个项目的执行工程师。项目是个人音乐 web 应用：
TypeScript + Hono + React 19 + Zustand，线上部署是 Cloudflare Worker + D1 + Cloudflare Access
（server/worker.ts 是生产入口；server/app.ts + server/node.ts 那条 Node 路径目前不用于生产）。

请先做三件事，做完汇报，不要改任何代码：
1. 完整读 docs/OPTIMIZATION-PLAN.md 和 docs/GROK-RUNBOOK.md。
2. 跑 npm ci && npm run typecheck && npm test && npm run build，确认基线：
   typecheck 无错、16 个测试文件 / 88 个测试通过、产物 JS 约 318 KB。
3. 用一句话概括你理解的执行方式（一条一条做、每条要贴验收数字、两处禁改项是什么）。

确认无误后我会给你第一条任务。
```

---

## P0 — 隐私阻断项

### P0-1 只读 demo 与生产共用同一个 D1

> ⚠️ **这条需要你（人）先在 Cloudflare 控制台操作**：`wrangler d1 create music-du-demo` 拿到新的 `database_id`，再把 id 交给 agent。
> 如果你暂时不想建新库，就让它走改法 B（demo 不绑 D1），agent 可以独立完成。

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 P0-1，其他条目一律不动。

背景：wrangler.toml:39（生产）和 wrangler.toml:68（[env.demo]）绑的是同一个 D1，
而 worker.ts:332-333 在 LIBRARY_READONLY 为真时直接放行 library 鉴权，
导致公开 demo 无鉴权返回生产库全量数据（实测 579 条收藏 + 277 条历史）。

按计划文档的改法 B + C 执行：
- B：删掉 wrangler.toml 里整段 [[env.demo.d1_databases]]，让 demo 走
  worker.ts:842-852 已有的「无 D1 → 503 + localOnly:true」降级分支。
- C：envReadonly 为真时，/api/library 响应剔除 history 和 curIdx，只返回 favorites；
  并给 [env.demo] 增加显式 DEMO_MODE = "true"，让只读判定需要两个信号同时成立。

验收：
1. 给 worker.ts 的 readonly 分支补单测：只读环境下响应不含 history 字段。
2. npm run typecheck && npm test 全绿。
3. 说明部署 demo 后需要人工验证的那一条：demo 域名 GET /api/library 不再包含生产库条目。
```

---

## M — 移动端（12 条，建议全部做完再动别的）

> 每条移动端任务的验收都用同一个脚本：`OPTIMIZATION-PLAN.md` 附录 A，视口 `390×844` 与 `320×568`，
> 主题 `aurora`(side) / `neon`(immersive) / `midnight`(compact)。

### M-1 immersive 布局在手机上把列表压成 30px 竖条

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-1，其他条目一律不动。

layouts.css:1012-1018 的 .imm-stage 是 grid-template-columns: minmax(240px, 320px) 1fr，
没有任何移动端断点。390px 视口下实测解析成 "320px 30px"，右侧列表只有 30px 宽，
tab 被压成竖排单字，40 行歌曲变成一列噪点。49 个主题里 21 个用 immersive 布局。

按计划文档 M-1 的三步改：加 max-width:860px 断点改单列纵向堆叠、
手机上 .imm-now 不再垂直居中撑满、移动端降低 .imm-bg 的 blur/scale 合成开销。

验收（跑附录 A 脚本，两个视口都要）：
- .imm-stage 计算值为单列（1fr）
- .imm-sheet 宽度 ≥ 视口宽 − 32px（现状 390 下是 30，320 下是 22）
- 首行 .track-row 的 y < 视口高度（现状 2389）
- 前 8 行歌名截断数 = 0（现状 8）
把这四个数字的实测值贴出来。
```

### M-2 窄屏搜索按需出现（修订：勿再做「两行常驻搜索」）

> 终态方案：`docs/SEARCH-MOBILE-PLAN.md`。原「两行 head 撑常驻框」已废弃为终态。

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md、docs/SEARCH-MOBILE-PLAN.md 与
docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-2（搜索 IA），其他条目一律不动。

背景：头部全局 SearchBar + 「搜索」tab 双入口；窄屏常驻框被压到 24–47px，且浏览
热榜/库/词时不需要搜索行。不要再做「两行 head 整宽常驻 search」作为终态。

按 SEARCH-MOBILE-PLAN 方案 A：
- ≤720px：头部不展示整行 SearchBar；仅 tab===search 时在面板顶部满宽 SearchBar；
  可选头部 🔍 → setTab("search")+focus。
- >720px：保留头部常驻 SearchBar。
- 仍做：收起 .skin-brand__theme；工具区简化；LocaleSwitcher 独立类名。

验收（390/320 + 桌面）：
- 非 search tab：.skin-head 内无可见搜索 input
- search tab：input 宽 ≥ innerWidth-32
- 热榜 rowsVisible 不因搜索行变差
- 桌面 1440 头搜仍可用
贴实测值。
```

### M-3 空闲播放器占半屏到全屏，列表在折叠线外

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-3，其他条目一律不动。前置：M-1、M-2 已完成。

三套布局都把 now-playing 当主角，即使没在播：side 402px、immersive 764px、compact 301px。
叠加头部与榜单元信息后，首行歌曲的 y 实测 815 / 2389 / 685（视口高 844），
40 行里完整可见 0 / 0 / 2 行。320×568 下 side 的列表容器高度只有 29px。

按计划文档 M-3 的三步改：
1. 未播放时给 .skin-host 挂 data-idle="1"，手机上压缩封面占位、隐藏 .np-badges 与音量行。
2. 播放中把 now-playing 折叠成底部迷你条（封面 40px + 标题 + 播放/下一首），
   完整播放器改为点迷你条上滑展开；可复用 CompactLayout.tsx:12-17 已有的 .player-bar 结构，
   做成三套布局共用的移动端形态。
3. 榜单元信息手机上折叠（.charts-desc/.charts-source/.charts-hint/.charts-updated 默认收起），
   平台/榜单 chips 从 flex-wrap 改单行横向滚动 + scroll-snap。

验收（附录 A 脚本，两个视口 × 三套布局）：
- 热榜 tab 首屏 rowsFullyVisible ≥ 3（现状 0/0/2）
- 首行 y < 视口高 − 120
贴出 6 组实测值（2 视口 × 3 布局）。
```

### M-4 触控目标普遍小于 44px

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-4，其他条目一律不动。

390 视口实测有 12–13 类可交互元素小于 44×44（iOS HIG / WCAG 2.5.5 下限）：
.skin-tabs button 46×34 与 33×34（layouts.css:138-147）、.t-btn.ghost 75×36/50×36/35×32（:571-596）、
.skin-switcher__btn 40×34~54×34（global.css:181-191）、.icon-btn 36×36（:439-447）、
.charts-chip/.charts-refresh min-height 32（:342-400）、进度条 244×28（:822-836）、音量条 237×28（:892-898）。

按计划文档 M-4 改：加 @media (pointer: coarse) 分支统一抬到 44px 命中区
（视觉尺寸可保持，用 ::before 扩大命中区或 padding + 负 margin）；
进度条与音量条把命中区提到 44px、拇指 16px，并加 touch-action: none 防止拖动时页面跟着滚。

验收：附录 A 脚本在移动上下文输出的 smallTargets 计数为 0（进度/音量条按命中区算），
并确认桌面端视觉尺寸没有变化（贴一张桌面 1440 宽的截图或说明）。
```

### M-5 输入框字号 < 16px，iOS 聚焦整页缩放

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-5，其他条目一律不动。

实测输入框字号：.skin-search input 14px（layouts.css:78-90）、
.skin-panel__search 13px（global.css:199-209）、range 11px。
Safari iOS 对 font-size < 16px 的输入框聚焦会自动放大整页且不还原。

按计划文档 M-5 改：@media (pointer: coarse) 下所有 input 的 font-size ≥ 16px，
视觉比例用 padding 或 transform 补偿，不要让头部变高。

验收：移动视口下 [...document.querySelectorAll("input")].map(e=>getComputedStyle(e).fontSize)
全部 ≥ 16px（现状 11px/13px/14px），贴输出；并确认 M-2 的头部高度 ≤ 112px 仍成立。
```

### M-6 触摸设备残留 hover 态

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-6，其他条目一律不动。

全项目 @media (hover: 出现 0 次，:hover 规则 11 处（layouts.css 6 / refined-base.css 4 / global.css 1），
例如 .skin-card:hover{transform:translateY(-1px)}、.badge-btn:hover{filter:brightness(1.08)}、
.lyrics-panel .ly:hover。实测手机轻点后 :hover 链仍挂在 .imm-now / .player-bar 上不释放。

按计划文档 M-6 改：所有 :hover 规则包进 @media (hover: hover) and (pointer: fine)；
触摸端改用 :active 提供按压反馈。

验收：移动视口轻点卡片/歌词行/徽标后，document.querySelectorAll(":hover") 不含这些元素，
贴输出；桌面端 hover 效果保持不变。
```

### M-7 底部安全区与动态视口高度

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-7，其他条目一律不动。

global.css:1-5 定义了 --safe-b / --safe-t，但 --safe-b 全项目只有 .toast（global.css:284）在用，
底部控件（音量行、compact 播放条、M-3 新增的迷你条）没有底部安全区内边距，
iPhone 上会压在 home indicator 下面。全项目 dvh/svh/lvh 出现 0 次，
html,body,#root{height:100%}（global.css:34-39）在 iOS 工具栏收放时会跳动。

按计划文档 M-7 改：底部容器加 padding-bottom: max(12px, env(safe-area-inset-bottom))；
.app-shell 高度改 100dvh 并保留 100% 回退；layouts.css:22 的顶部安全区已处理，保持不动。

验收：390×844 且模拟 env(safe-area-inset-bottom: 34px) 时，
底部最后一个可交互元素的 bottom ≤ 视口高 − 34，贴实测值。
```

### M-8 主题面板在手机上要滚约 7 屏

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-8，其他条目一律不动。

实测 390 视口下主题面板 366×520，内容 scrollHeight 3809px（49 张 340×68 卡片单列）→ 约 7 屏滚动；
没有分组、没有关闭按钮（SkinSwitcher.tsx:60-129 只能点外面关）；
面板锚在头部（SkinSwitcher.tsx:70-82），屏幕下方 1/3 完全没用上。

按计划文档 M-8 的五步改：手机改底部抽屉（fixed inset:auto 0 0 0; max-height:85dvh; 顶部拖拽条 +
显式关闭按钮）、按 layout 分组或加过滤 chips、卡片改 2 列紧凑网格、
筛选框补 type="search" + enterkeyhint 且字号 16px、
role="dialog" 补 aria-modal 与焦点管理（打开聚焦筛选框、关闭还原焦点、Tab 锁在面板内）、
App.tsx:81-92 的外部关闭补 touchstart/pointerdown。

验收：390 视口下选中任意主题所需滚动距离 ≤ 1 屏；面板可用显式按钮关闭；
键盘 Tab 不会跑出面板。贴 scrollHeight 实测值（现状 3809）。
```

### M-9 歌词只占 1/4 屏且高亮行不居中

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-9，其他条目一律不动。前置：M-3 已完成（迷你条形态可复用）。

390 视口实测 .lyrics-scroller 高度：side 209px（占 25%）、compact 391px、immersive 492px；
高亮行 y 分别 687 / 625 / 396，前两者贴在底部而非视觉中心。
.lyrics-spacer 用 min(28vh,160px)（layouts.css:480-484），矮视口下不足以把首行推到中间。

按计划文档 M-9 改：手机上歌词 tab 进全屏模式（隐藏 now-playing 大区块只留迷你条）、
spacer 改成基于滚动容器实际高度的 50%、
LyricsView 居中滚动改等效 block:"center" 计算并保留用户手动滚动后 3 秒不抢滚。

验收：390 视口歌词 tab 下 .lyrics-scroller 高度 ≥ 视口 60%（现状 side 25%）；
高亮行中心与容器中心偏差 ≤ 40px。三套布局各贴一组实测值。
```

### M-10 tab 标签被压成单字

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-10，其他条目一律不动。前置：M-1、M-3 已完成。

compact 布局用 tabs="short"（CompactLayout.tsx:10），手机上渲染成「搜 热 列 心 史 词」；
immersive 在 M-1 之前被 30px 竖条压成竖排单字。单字标签可读性差、也不好点。

按计划文档 M-10 改：移动端 tab 改「图标 + 短词」的横向滚动条，或直接做底部 tab bar
（更符合手机习惯，且能配合 M-3 进一步释放垂直空间）。至少保证 2 字词而不是 1 字。

验收：移动视口下每个 tab 的可见文本长度 ≥ 2 个字符，tab 行不换行（横向可滚），
每个 tab 命中区 ≥ 44px（与 M-4 一致）。贴 tab 文案与尺寸清单。
```

### M-11 全屏滑动手势与列表滚动冲突

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-11，其他条目一律不动。前置：M-3 已完成。

App.tsx:60-67 把 attachSwipeNav（lib/swipe-nav.ts）挂在整个 .app-shell 上，左右滑 = 上/下一首。
手机上横向滑动出现在很多地方（M-3 引入的 chips 横滚、歌词、误触），全屏级手势容易误切歌。

按计划文档 M-11 改：手势范围收窄到 now-playing / 迷你条区域；
阈值提高到水平位移 > 60px 且 |dx| > 2|dy|；
横向可滚容器标 data-no-swipe 并在处理器里跳过。

验收：榜单纵向滚动、chips 横向滚动时不触发切歌；迷你条上横滑正常切歌。
给 lib/swipe-nav.ts 的阈值与跳过逻辑补单测。
```

### M-12 清理死文件里的移动端样式

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 M-12，其他条目一律不动。放在 M 组最后做。

client/src/skins/themes/all-themes.css（769 行 / 17.8 KB）全项目无任何 import，
里面还有两处 @media (max-width: 800px)（:332、:699）——历史移动端适配写在了不生效的文件里。

改法：确认无用后删除；若其中有值得保留的移动端规则，先迁进 layouts.css 的新断点再删。
注意 tests/skins-static.test.ts 有检查 CSS 文件存在性的断言，需要同步更新。

验收：rg "all-themes" client/ 无结果；npm test 全绿；npm run build 后 CSS 体积不增加
（基线 26.6 KB / gzip 6 KB），贴前后体积对比。
```

---

## P1 — Worker + D1 成本与性能（5 条）

### P1-1 每播一首歌重写整张 history 表（约 200 行写）

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 P1-1，其他条目一律不动。这是本组收益最大的一条，改前先把方案讲给我确认。

现状：客户端 history 上限 200（store/player.ts:1179-1182），每次 playTrack 把新歌 prepend 到队首；
history 按稠密 pos 存储，prepend 使所有行 pos 位移，writeList（worker.ts:187-238）因此对
全部约 200 行执行 INSERT OR REPLACE。按 D1 免费额度 10 万写/天算，约 500 首/天触顶。

按计划文档 P1-1 的免迁移方案改：把 history 的 pos 当作单调递减序号而不是稠密下标。
- loadLib（worker.ts:154-180）已是 ORDER BY pos ASC，读取侧不改。
- 新增 history 专用写入路径：读现有 sid→pos 映射，客户端传来的 id 中已存在的保留原 pos，
  新 id 分配 min(pos) - 1（允许负数），只写新增/变化的行；超上限的按 pos DESC 删尾部。
- playlist / favorites 保持现有 writeList（用户显式排序，稠密 pos 有意义）。

验收：
1. 给 library-merge.ts 补纯函数单测：200 条现有 history + 1 条新歌 → 规划出的写语句数 ≤ 3。
2. 连播 10 首后 GET /api/library 的 history 顺序与客户端一致（写个集成测试或贴手动验证过程）。
3. npm test 全绿，并说明这个改动对已有 D1 数据的兼容性（现存稠密 pos 数据是否需要处理）。
```

### P1-2 一次 PUT 读了三遍全库

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 P1-2，其他条目一律不动。前置：P1-1 已完成。

worker.ts:1205 调 loadLib，saveLib 内部又在 worker.ts:255（取 existing 比对）和
worker.ts:272（组装返回值）各调一次。每次 loadLib 扫 3 张列表约 856 行 → 单次 PUT 约 2500 行读。

按计划文档 P1-2 改：saveLib 增加 existing 入参由调用方传入已读快照；
返回值用本地已算好的 {playlist, favorites, history, curIdx, revision} 组装，不再 loadLib；
保留一个 ?verify=1 调试开关走原路径。

验收：单次 PUT 的 loadLib 调用次数 = 1（用 mock D1 统计 prepare 调用次数写成单测）；
tests/library-merge.test.ts 原有断言全部不变。贴调用次数前后对比。
```

### P1-3 每个请求都跑一遍建表 DDL

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 P1-3，其他条目一律不动。

ensureSchema（worker.ts:98-110）= ensureResolveCacheSchema（2 条 DDL，resolve-cache.ts:24-44）
+ 2 条 CREATE TABLE IF NOT EXISTS，被 loadLib:155 / saveLib:241 / deleteSid:281 各自调用；
ensureResolveCacheSchema 还在 worker.ts:507/550/603/661/751 独立调用。
叠加 P1-2 之前的三次 loadLib，一次 PUT 累计约 16 条 DDL。

按计划文档 P1-3 改：isolate 级记忆化——模块作用域 let schemaReady: Promise<void> | null，
首次调用建 Promise 后复用，失败时置回 null 允许重试。
注意：不同 D1 实例（测试里会 new 多个）不能共用同一个标记，用 WeakMap<D1Database, Promise> 更安全。

验收：同一 isolate 内连续 5 次 GET /api/library 只执行一次 DDL
（mock D1 统计 CREATE TABLE 出现次数，写成单测）。贴次数对比。
```

### P1-4 客户端 history 落库节流过激进

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 P1-4，其他条目一律不动。

persistSoon 固定 500ms 防抖（store/player.ts:2388-2397），flushLibrarySave（:2399-2461）
每次 PUT 整库，payload 实测 171 KB（gzip 64 KB）。连续切歌 = 连续大 PUT。

按计划文档 P1-4 改：
1. 分级节流：收藏/队列等显式操作保持 500ms；history/curIdx 走 15–30s 慢通道，
   并在 visibilitychange / pagehide 时强制 flush。
2. localStorage 镜像（player.ts:2420）从 flushLibrarySave 里提前到状态变更时立即写，
   避免慢通道导致关页丢历史——这一步是防数据丢失的关键，务必先做。
3. 可选：PUT 只带变化的列表（服务端 mergeTrackList 已支持缺省列表不覆盖，见 library-merge.ts:52）。

验收：连续切 10 首歌产生的 PUT /api/library 次数 ≤ 2（贴网络面板截图或计数日志）；
切歌后立刻刷新页面，本地 history 不丢（贴验证过程）。
```

### P1-5 六个小口子（可以一条一个 commit）

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 P1-5 的六个小项，其他条目一律不动。每个小项一个 commit。

a) wrangler.toml:13 compatibility_date = "2025-01-01" 落后约 19 个月 → 升到近期日期，
   升完必须跑一遍 scripts/smoke-prod.sh 之外的本地 smoke 验证，并说明有哪些行为变更风险。
b) worker.ts:345 host.endsWith(h) 无点边界（"dubin.cc" 会匹配 "xxdubin.cc"）
   → 只保留 host === h || host.endsWith("." + h)，补单测。
c) worker.ts:398-399 /api/health 公开返回上游 api_base / fallback_base → 去掉，或仅带 token 时返回。
d) library-merge.ts:113-117 token 用 === 比较（时序泄露），worker.ts:361-372 还接受 ?token= 与 cookie
   → 改等长常量时间比较，query 方式标记 deprecated 并在文档里注明风险。
e) 各 handler 把 e?.message 原样返回客户端（如 worker.ts:434-435）→ 对外通用文案，细节只进日志。
f) 确认 pruneResolveCache（resolve-cache.ts:153-182）的 waitUntil 已覆盖主要路径
   （worker.ts:565/676），只需报告结论，不用改。

验收：npm run typecheck && npm test 全绿；b/d 各有对应单测；逐项说明改了什么。
```

---

## F — 前端交互与展示（10 条）

> 先记住一个结论：**打包体积不是瓶颈**（318 KB / gzip 100 KB，主题目录只占 7%），不要花力气拆 chunk。

### F-1 播放中每秒 4–10 次全组件重渲染

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-1，其他条目一律不动。改前把拆分方案讲给我确认。

tick()（store/player.ts:1837-1854）在每个 timeupdate 更新 currentTime/duration/buffered/playing/lyricIdx；
Transport.tsx 挂 21 个 usePlayer 选择器、TrackList.tsx 12 个、
MediaSession.tsx:15-18,204 订阅 currentTime 导致每 tick 重跑 effect。

按计划文档 F-1 的四步改：时间类状态拆到独立轻量 store（或 useSyncExternalStore + ref）、
进度填充直接写 CSS 变量（--seek-play / --seek-buf 已存在，layouts.css:747-758）不走 React 状态、
MediaSession 的 setPositionState 节流到 1Hz、
lyricIdx 只在 tick() 算一次并删掉 LyricsView.tsx:116-124 的重复计算。

验收：React DevTools Profiler 下播放中 1 秒内 TrackList 与 SkinHead 的 commit 次数为 0，
进度条仍平滑（贴 Profiler 数据或计数日志）；tests/player-core.test.ts 与 play-switch.test.ts 保持通过。
```

### F-2 长列表无虚拟化、行无 memo

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-2，其他条目一律不动。前置：F-1 已完成。

TrackList.tsx:212-332 直接 tracks.map，579 条收藏 = 579 个 DOM 行 × 每行一张封面；
curTrack / loadingPlay / locateRequest 任一变化即整列表重渲染；
行内 ref 回调每次渲染都重建（TrackList.tsx:218-222）。

按计划文档 F-2 改：抽出 memo 化的 TrackRow，行内只订阅 active/loading 两个布尔量；
列表超过约 100 项时上虚拟滚动；ref 回调用 useCallback 稳定化。
注意：locateCurrentInList（G / . 快捷键）依赖 rowRefs 定位，虚拟化后要保证"定位到正在播放"仍可用。

验收：579 项列表首次渲染 < 200ms（Performance 面板）；切歌时只有 2 行发生 commit；
G 键定位功能仍正常。贴数据。
```

### F-3 封面预热把 loading="lazy" 完全抵消

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-3，其他条目一律不动。

CoverImg.tsx:72 正确用了 loading="lazy"，但 CoverImg.tsx:56-60 的 useEffect 对每个渲染出来的行
调 warmCoverFromRemote，它会 (a) new Image() 立即请求直连 CDN（cover-browser-cache.ts:63-72，
绕过懒加载）(b) fetch 一次同源 /api/cover-proxy 并写 Cache Storage（:73）。
579 行约 1158 个请求。且 kazam-covers-v3 这个 Cache Storage 没有任何容量上限或淘汰。

按计划文档 F-3 改：CoverImg 去掉逐行预热，改由列表容器用 IntersectionObserver 只预热
视口附近的项（复用 cover-browser-cache.ts:77-87 的 warmTrackCovers，它已有 40 条上限与错峰）；
给 Cache Storage 加条数上限与 LRU 清理；
移动网络（navigator.connection.saveData 或 effectiveType 含 2g）下只走直连不写 Cache。

验收：打开 579 项收藏列表，Network 面板首屏请求数 < 60（现状约 1158），滚动后按需增长。
贴请求数前后对比。
```

### F-4 加载与空态过于朴素

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-4，其他条目一律不动。

加载态靠 .track-row.loading 的 CSS 伪元素追加文案（global.css:262-271），
而且文案硬编码中文 content: " · 加载中"；.empty（layouts.css:524-530）只有一行灰字；
歌词空态不区分「加载中 / 无歌词 / 加载失败」（LyricsView.tsx:194-204）。

按计划文档 F-4 改：列表/榜单加载用骨架屏（重复 6 行灰块，尊重 prefers-reduced-motion，
global.css:341-346 已有该媒体查询）；伪元素文案改 React 渲染 + i18n；
歌词与列表空态区分三种状态并给出可操作按钮（重试 / 去搜索）。

验收：切换 tab 时不出现「白屏 → 突然满屏」；rg "加载中" client/src/styles 无结果；
i18n 的 zh/en 都补齐新增文案键。贴三种空态的截图。
```

### F-5 主题选择的信息架构

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-5，其他条目一律不动。前置：M-8 已完成（移动端抽屉形态）。

49 个主题平铺（SkinSwitcher.tsx:95-124），只能靠名字/tagline 文本过滤；
卡片只有一条 4px 色板（global.css:245-251），选之前看不出布局差异；
主题名与 tagline 全是中文硬编码（theme-catalog.ts，49 × 2 条），英文界面下仍显示中文；
头部视觉最重的 primary 按钮其实是「随机切换」（SkinSwitcher.tsx:146-154），比"打开主题列表"更抢眼。

按计划文档 F-5 改：卡片加迷你布局缩略图（三个 div 拼出 side/immersive/compact 形态）+ 主色/强调色双色块；
按 layout 分组或加过滤；给 ThemeTokens 增加 nameEn/taglineEn（或 i18n key）并在英文下使用；
头部主次调换（主题列表为主按钮，随机切换降为次要图标）。
注意 tests/skins-static.test.ts 有主题目录完整性断言，新增字段要同步。

验收：英文界面下主题面板无中文；从打开面板到选中目标主题的滚动距离 ≤ 1 屏；npm test 全绿。
```

### F-6 i18n 漏网的硬编码文案

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-6，其他条目一律不动。前置：F-4、F-5 已完成（它们会引入新文案）。

漏网清单：Transport.tsx:190 音量 aria-label="音量"；global.css:267 " · 加载中"；
ChartsPanel.tsx:13-20 的 FALLBACK_PLATFORMS 平台名（抖音/网易云…）；
store/player.ts:479-481 默认榜单名与描述；server/app.ts:60 的 note 字段中文直出到 API；
theme-catalog.ts 全部主题名/tagline。

按计划文档 F-6 改：全部走 i18n；
tests/i18n.test.ts 增加键值对齐检查（en.ts 与 zh.ts 结构一致）；
再加一条 lint 式测试：client/src/components 与 client/src/store 下不允许出现
连续 2 个以上 CJK 字符的字面量（主题名等白名单除外）。

验收：切到英文后通篇无中文（主题名按 F-5 的方案处理）；新增两条测试通过；npm test 全绿。
```

### F-7 可访问性

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-7，其他条目一律不动。

缺失项：TrackList.tsx:224-233 播放中行只有 playing class 无 aria-current；
role="button" 的行没有 aria-label 说明；主题面板无 aria-modal 与焦点管理（SkinSwitcher.tsx:63-66，
若 M-8 已做则复核）；进度条与音量 input[type=range] 缺 aria-valuetext（读屏只读出秒数原值）；
确认 Toast（components/Toast.tsx）有 role="status" + aria-live="polite"。

按计划文档 F-7 逐项补齐。
再次提醒：KeyboardShortcuts.tsx:29 的 defaultPrevented 守卫不要动。

验收：Lighthouse Accessibility ≥ 95（贴分数）；
键盘可完成「搜索 → 播放 → 收藏 → 切主题」全流程（贴操作步骤）。
```

### F-8 Service Worker 更新流程

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-8，其他条目一律不动。

client/public/sw.js:2 缓存名固定 music-shell-v1，activate 只删其他名字的缓存（:11-17），
所以历次部署的哈希资源在同一缓存里无限堆积；
main.tsx:13-18 注册后调 skipWaiting 但没监听 controllerchange，
用户可能停留在 HTML 与 JS 版本不匹配的状态。

按计划文档 F-8 改：缓存名带构建版本（构建时替换或 import.meta.env 注入）；
activate 清理旧版本；主线程监听 controllerchange 后 reload 一次
（用 sessionStorage 标记防循环），或弹「有新版本，点击刷新」的 toast。

验收：连续两次构建部署后 Cache Storage 只保留当前版本条目；
新版本上线后一次刷新即生效。贴两次构建的缓存名与 Cache Storage 内容。
```

### F-9 首屏 9 个 Google 字族阻塞渲染

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-9，其他条目一律不动。这条对国内访问的首屏体感影响最大。

client/index.html:17-20 用一个阻塞样式表从 fonts.googleapis.com 加载 9 个字族
（Bebas Neue / DM Sans / IBM Plex Mono / Instrument Serif / JetBrains Mono / Outfit /
Playfair Display / Space Grotesk / Syne）。这 9 个确实被 49 个主题分别引用，
但任一时刻只有当前主题的 1–2 个有用。fonts.googleapis.com 在国内不可达，
浏览器会为待定 CSS 阻塞渲染直到超时。字体栈有 "PingFang SC", system-ui 兜底（global.css:42），
所以最终能显示，只是白等。

按计划文档 F-9 改：首屏只加载基础字族（DM Sans）或全部走系统字体；
其余字族在主题切换时动态注入 <link>（SkinHost 里按 meta.font 解析需要的字族）；
更彻底的做法是自托管 woff2 子集走自己的域名。无论哪种，<link> 都要非阻塞加载。

验收：用 hosts 屏蔽 fonts.googleapis.com 后，首屏内容渲染时间与联通时相差 < 200ms（贴两次实测）；
主题切换后对应字族 1s 内生效。
```

### F-10 六个交互细节（可以一条一个 commit）

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 F-10 的六个小项，其他条目一律不动。每个小项一个 commit。

a) 搜索无历史、无建议、无清空按钮（SearchBar.tsx 47 行）→ 加最近搜索（localStorage 上限 10）与一键清空。
b) 列表行操作按钮常显（TrackList.tsx:263-274），手机上挤压歌名 → 桌面 hover 显示，
   移动端改左滑操作或长按菜单（注意与 M-11 的手势规则不冲突）。
c) 播放失败提示区分不足（store/player.ts:1433-1437,1464-1478 两种 toast）→ 区分
   「自动播放被拦截（需手势）」「网络失败（可重试）」「无版权/无源」三类，并给重试按钮。
d) 音质菜单 .quality-menu 用 translateX(-50%) + max-width: min(18rem, 80vw)（layouts.css:617-638），
   靠近屏幕边缘可能溢出 → 加边界检测或改 position:fixed 的锚定弹层。
e) 无全局「正在播放」可见性 → 已由 M-3 的迷你条解决，只需复核并报告。
f) client/src/lib 下五个缓存文件各自实现 TTL/LRU/localStorage（song-cache / lyric-cache /
   chart-cache / cover-browser-cache / audio-cache）→ 抽 lib/cache-store.ts 泛型实现，
   各自只声明 key/ttl/max。这一项改动面大，先给我方案再动手。

验收：a/c/d 各贴一段操作验证；f 要保证 tests/quality.test.ts 等现有缓存相关测试全绿。
```

---

## Q — 工程质量（4 条，可以放最后）

### Q-1 双份后端实现导致行为漂移

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 Q-1，其他条目一律不动。改前先给我重构方案。

server/worker.ts（1335 行）与 server/app.ts（330 行）把 search / charts / song / qualities /
lyric / stream / cover-proxy / library / favs 各实现了一遍，已出现 4 处漂移：
- /api/song/:sid：Worker 有 D1 resolve 缓存 + 边缘缓存（worker.ts:582-699）；
  Node 无缓存但支持 ?qualities=1 内联探测（app.ts:114-125，最多 8 次上游调用）
- /api/stream/:sid：Worker 302 跳转（worker.ts:743-804，不要改）；
  Node 全字节代理 + Range（app.ts:179-204），且 fetch 无超时（app.ts:194）
- /api/cover-proxy 失败：Worker 502（worker.ts:833-834）vs Node 404（app.ts:247-251）
- charts 强制刷新：Worker 只认 force（worker.ts:455）vs Node 认 force 与 refresh（app.ts:79）

第一阶段只做「对齐 + 补测」这 4 项，不要动大重构；
共享路由工厂的方案写成设计说明给我，下一轮再实施。

验收：4 项行为一致（Node 侧 fetch 补 30–60s AbortController 超时）；
每项一条单测；npm test 全绿。
```

### Q-2 Node 路径无鉴权且与文档不符

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 Q-2，其他条目一律不动。

app.ts:255（GET）、:294（PUT）、:308（DELETE）、:291-292（/favs、/export）都没有
MUSIC_ACCESS_TOKEN 或 LIBRARY_READONLY 检查（这些只在 worker.ts:328-378），
但 README.md:108 与 docs/API.md 声称 token 会保护 library API。
另：README.md:128 写的 /import 只在 Worker 里存在。

按计划文档 Q-2 改：把 libraryUnauthorized / isLibraryReadonly 提到共享模块并在 createApp 里应用；
node.ts:28-33 的 readBody 加请求体上限（1–2 MB → 413）；
node.ts:71-72 的 response.arrayBuffer() 改流式 pipe（现在会把整首歌缓冲进内存）；
node.ts:155-162 补 SIGTERM/SIGINT 优雅退出；app.ts:25 的 cors() 收紧到已知来源。
README 与 docs/API.md 同步修正（含 /import 仅 Worker 可用的说明）。

验收：给 app.ts 的鉴权矩阵补单测（有 token / 无 token / readonly / 缺 token 配置）；
流式改造后用 curl -r 0-1023 验证 Range 仍可用；npm test 全绿。
```

### Q-3 测试覆盖缺口正好在生产代码上

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 Q-3，其他条目一律不动。

现有 16 个测试文件覆盖的是纯函数与 Node 侧；零测试的是：
server/worker.ts（线上真正跑的 1335 行）、server/node.ts、resolve-cache.ts、edge-cache.ts、
cover-cache.ts、cover-fetch.ts、charts-disk.ts、config.ts，以及全部 React 组件
（store/player.ts 只有 hardStopAudio 被覆盖）。

按计划文档 Q-3 改：优先给 worker.ts 加集成测试（wrangler unstable_dev 或 mock Env + mock D1），
覆盖 library 鉴权矩阵（readonly / 有 token / 无 token / 缺 D1）、revision 冲突、
以及 P1-1 的 history 写入规划；再给 TrackList / Transport 加 React Testing Library 冒烟测试。

验收：新增测试数量与覆盖模块清单；npm test 全绿；
说明 worker.ts 的测试是怎么 mock D1 的（后续所有 Worker 改动都要靠它兜底）。
```

### Q-4 缺少 lint / 依赖治理 / PR 构建

```
项目 music-du。先读 docs/OPTIMIZATION-PLAN.md 与 docs/GROK-RUNBOOK.md 的「通用约束」，严格遵守。
本轮只做 Q-4，其他条目一律不动。

现状：全仓库没有 ESLint / Prettier / Biome 配置；没有 .github/dependabot.yml，没有 CodeQL；
.github/workflows/ci.yml:31-32 的 test job 只跑 typecheck + test，不跑 npm run build
（客户端打包在 PR 上完全没验证）；scripts/smoke.ts 从未接入 CI；
package.json:26 的 @hono/node-server 是 dependency 但代码从未 import；
package-lock.json 根 name 仍是旧项目名 kazam；
Dockerfile 以 root 运行、无 HEALTHCHECK、基础镜像用浮动 tag。

按计划文档 Q-4 逐项补。lint 规则从宽开始（no-unused-vars、react-hooks/*、import/order），
避免一次性产生上千条报错——如果开箱报错超过 50 条，先把规则降级为 warn 并在 PR 里说明。

验收：npm run lint 通过（或仅剩 warn）；CI 的 test job 加上 npm run build；
dependabot 与 CodeQL 配置就位；Dockerfile 改非 root + HEALTHCHECK + 镜像按 digest 固定；
npm run typecheck && npm test 全绿。
```

---

## 收尾（全部做完后）

```
项目 music-du。32 条任务已全部完成。请做收尾检查并汇报，不要再改功能代码：
1. npm run typecheck && npm test && npm run build 全绿，贴产物体积与基线（318 KB / 26.6 KB）对比。
2. 跑一遍 OPTIMIZATION-PLAN.md 附录 A 的移动端审计脚本，把「移动端验收目标值」表格里
   7 个指标的最终实测值全部贴出来。
3. 列出所有 commit（编号 + 一句话），标出哪些条目改动了公开接口返回值或数据库写入方式
   （部署时需要我重点观察的）。
4. 列出你在执行过程中发现但没有修的问题（按通用约束第 1 条只记录不修的那些）。
```

---

## 进度表

| # | 编号 | 任务 | 状态 |
|---|---|---|---|
| 0 | — | 开场：读文档 + 跑基线 | ☐ |
| 1 | P0-1 | demo 与生产共用 D1（需人工建库或走改法 B） | ☐ |
| 2 | M-1 | immersive 移动端断点 | ☐ |
| 3 | M-2 | 头部搜索框被挤到 24px | ☐ |
| 4 | M-3 | 空闲播放器占屏 / 迷你条 | ☐ |
| 5 | M-4 | 触控目标 44px | ☐ |
| 6 | M-5 | 输入框 16px 防缩放 | ☐ |
| 7 | M-6 | hover 态 | ☐ |
| 8 | M-7 | 安全区 + dvh | ☐ |
| 9 | M-8 | 主题面板底部抽屉 | ☐ |
| 10 | M-9 | 歌词全屏 + 居中 | ☐ |
| 11 | M-10 | tab 标签 | ☐ |
| 12 | M-11 | 滑动手势范围 | ☐ |
| 13 | M-12 | 删死文件 all-themes.css | ☐ |
| 14 | P1-1 | history 单调 pos（约 200 次写 → 1–2 次） | ☐ |
| 15 | P1-2 | 一次 PUT 三次 loadLib → 一次 | ☐ |
| 16 | P1-3 | 建表 DDL 记忆化 | ☐ |
| 17 | P1-4 | history 落库分级节流 | ☐ |
| 18 | P1-5 | 六个小口子 | ☐ |
| 19 | F-1 | tick 重渲染 | ☐ |
| 20 | F-2 | 列表 memo + 虚拟化 | ☐ |
| 21 | F-3 | 封面预热抵消懒加载 | ☐ |
| 22 | F-4 | 骨架屏 / 空态分类 | ☐ |
| 23 | F-5 | 主题面板信息架构 | ☐ |
| 24 | F-6 | i18n 硬编码 | ☐ |
| 25 | F-7 | 可访问性 | ☐ |
| 26 | F-8 | SW 版本与更新流程 | ☐ |
| 27 | F-9 | 字体阻塞首屏 | ☐ |
| 28 | F-10 | 六个交互细节 | ☐ |
| 29 | Q-1 | 双份后端对齐 | ☐ |
| 30 | Q-2 | Node 鉴权 + 文档 | ☐ |
| 31 | Q-3 | 测试补齐 | ☐ |
| 32 | Q-4 | lint / CI / 依赖治理 | ☐ |
| — | — | 收尾检查 | ☐ |
