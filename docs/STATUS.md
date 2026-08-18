# Current project status

**Updated:** 2026-08-18 · display + play/chart/stream pass on `cursor/display-and-correctness-fixes-2fd6`  
This is the living brief for humans and agents. Do **not** execute `OPTIMIZATION-PLAN.md` or `GROK-RUNBOOK.md` — those 2026-08-12 construction docs are closed.

## What this app is

Personal music SPA + BFF. Production for the maintainer is **Cloudflare Workers + D1 + Access** (`music.dubin.cc`). Public read-only demo is a **separate** Worker + D1 (`music.du.dev`). Node + SQLite is for local / VPS / Docker / Fly.

| | |
|--|--|
| Default skin | `stage-dim`（暗场） |
| Layouts | **14** — 10 experience shells (dock/desk/feed/stage/verse/likes/recent/find/boards/split) + side / immersive / compact / gallery |
| Themes | **71** (classic palettes + dim/deep per experience + gallery pale/deep) |
| Tests | 46 files / 357 tests (`npm test`) |
| Main JS (prod) | ~194 KB / **gzip ~61 KB** after layout `React.lazy` |
| CI | lint + typecheck + test + build; push to `main` deploys primary + demo Workers |

## Auth (do not re-introduce a baked SPA token)

| Site | Gate |
|------|------|
| Private Worker | **Cloudflare Access** on the hostname. No `MUSIC_ACCESS_TOKEN`. |
| Demo Worker | Public. `LIBRARY_READONLY=true` + `DEMO_MODE=true`. Separate D1 `music-du-demo`. GET library strips `history` / `curIdx`. Writes / `/favs` / `/import` → 403. |
| Node | Open if `LIBRARY_TOKEN` unset (local default). If set, `Authorization: Bearer …` or `X-Library-Token` is required on library / favs / import. CORS does not reflect arbitrary origins. |

Never bake a library token into the Vite bundle (`VITE_MUSIC_ACCESS_TOKEN` must stay empty).

## Already shipped (do not re-open)

**Privacy / Worker cost:** separate demo D1; readonly GET strip; sparse D1 list writes; `ensureSchema` + resolve-cache DDL memoized; history `planHistoryWrites`; client 500ms/20s persist; saveLib batches list statements and bumps `revision` last; import 2MB cap; list/pos index in `ensureSchema`.

**Mobile / UX:** immersive breakpoints; scheme B search overlay + `visualViewport`; 44px coarse targets; theme drawer; quality menu portalled; SW build-stamped cache + `SKIP_WAITING`; no first-visit reload loop; `tabTouched` / `queueTouched`; search generation token; classic-layout `--search-overlay-bottom`; mobile quality chip (`quality-wrap--keep`); idle ≤400px classic shells keep a play button; idle stage compresses art/seek without hiding wings.

**Frontend:** `playback-clock`; TrackList memo + **real window virtualization** (≥80 thumb rows); layout code-split; Latin `@fontsource` + system CJK; i18n zh/en aligned; stage EN wing shorts; toast/drawer/Go/seek/empty-cover use theme tokens; missing art shows a note glyph; one quality picker on side/immersive/compact; charts heading not doubled on stage/verse/gallery.

**Node / quality:** optional `LIBRARY_TOKEN`; tight CORS; stream SSRF block (`server/safe-url.ts`) on **Node and Worker** 302; generic upstream errors; SQLite transaction + upsert + revision 409; empty `writeList` deletes the list (same-second force-clear); `/import` on Node; chart warm loop cleared on SIGTERM; Kugou/Kuwo charts over HTTPS.

**Play:** QQ/Kugou native resolve; ChKSz `api.chksz.com`; HTML error pages retryable; `warmTrack` respects `playToken`/`loadingPlay`; `loadCharts` uses `chartGen`.

## Do not add

- More theme/layout shells unless the user asks (14 × 71 is already a maintenance tax).
- Paid CF products (R2, paid KV, Image Resizing, Workers AI).
- Audio bodies on the Worker (keep 302 to CDN).
- A second in-app Access/token on the private Worker.

## Optional leftovers (not blocking)

| Item | Notes |
|------|--------|
| Split `player.ts` (~2600 lines) | Incremental slices only; `playback-clock` is the pattern |
| SearchOverlay chunk size | Still statically imported + modulepreloaded (~44 KB gzip with TrackList) |
| Virtual row default 56 vs CSS 64 | First measure self-corrects; brief scroll jitter on long lists |
| Lighthouse a11y in CI | Not instrumented |
| CodeQL | Not in workflows |
| Multi-device history union on 409 | Server snapshot wins today |

## Verify

```bash
npm test && npm run typecheck && npm run lint && npm run build
```
