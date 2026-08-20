# Current project status

**Updated:** 2026-08-20 · pocket paper/ink phone skins (`cursor/pocket-mobile-themes-2fd6`)  
This is the living brief for humans and agents. Do **not** execute `OPTIMIZATION-PLAN.md` or `GROK-RUNBOOK.md` — those 2026-08-12 construction docs are closed.

## What this app is

Personal music SPA + BFF. Production for the maintainer is **Cloudflare Workers + D1 + Access** (`music.dubin.cc`). Public read-only demo is a **separate** Worker + D1 (`music.du.dev`). Node + SQLite is for local / VPS / Docker / Fly.

| | |
|--|--|
| Default skin | `stage-dim`（暗场） |
| Layouts | **15** — 10 experience shells + pocket + side / immersive / compact / gallery |
| Themes | **73** (classic palettes + dim/deep per experience + gallery pale/deep + pocket paper/ink) |
| Tests | 54 files / 408 tests (`npm test`) |
| Main JS (prod) | ~194 KB / **gzip ~60 KB** after layout + SearchOverlay `React.lazy` |
| CI | lint + typecheck + test + build + `check:bundle`; CodeQL on PR/main; push to `main` deploys primary + demo Workers |

## Auth (do not re-introduce a baked SPA token)

| Site | Gate |
|------|------|
| Private Worker | **Cloudflare Access** on the hostname. No `MUSIC_ACCESS_TOKEN`. |
| Demo Worker | Public. `LIBRARY_READONLY=true` + `DEMO_MODE=true`. Separate D1 `music-du-demo`. GET library strips `history` / `curIdx`. Writes / `/favs` / `/import` → 403. |
| Node | Open if `LIBRARY_TOKEN` unset (local default). If set, `Authorization: Bearer …` or `X-Library-Token` is required on library / favs / import. CORS does not reflect arbitrary origins. |

Never bake a library token into the Vite bundle (`VITE_MUSIC_ACCESS_TOKEN` must stay empty).

## Already shipped (do not re-open)

**Privacy / Worker cost:** separate demo D1; readonly GET strip; sparse D1 list writes; `ensureSchema` + resolve-cache DDL memoized; history `planHistoryWrites`; client 500ms/20s persist in `library-persist.ts`; saveLib batches list statements and bumps `revision` last; import 2MB cap; list/pos index in `ensureSchema`.

**Mobile / UX:** immersive breakpoints; scheme B search overlay + `visualViewport`; overlay is `React.lazy` (preload on pointerdown so iOS still focuses in-gesture); 44px coarse targets; theme drawer (current-layout filter + recents); quality menu portalled; SW build-stamped cache + `SKIP_WAITING`; no first-visit reload loop; `tabTouched` / `queueTouched`; search generation token; classic-layout `--search-overlay-bottom`; mobile quality chip (`quality-wrap--keep`); idle ≤400px classic shells keep a play button; idle stage compresses art/seek without hiding wings; **pocket** (`袋·纸` / `袋·墨`) keeps cover + lyrics on one page (segment + tap cover), no lyrics sheet / close button.

**Frontend:** `playback-clock` + `lyric-clock`; TrackList memo + **real window virtualization** (64px row); layout code-split; Latin `@fontsource` (DM Sans at boot) + system CJK; display font waits for `ensureThemeFont`; i18n zh/en aligned; stage EN wing shorts; toast/drawer/Go/seek/empty-cover use theme tokens; missing art shows a note glyph; one quality picker on side/immersive/compact; charts heading not doubled on stage/verse/gallery; SkinHostFrame owns `data-idle` / `data-tab`; swipe-nav rebind is debounced.

**Node / quality:** optional `LIBRARY_TOKEN`; tight CORS; stream SSRF block (`server/safe-url.ts`) on **Node and Worker** 302; generic upstream errors; SQLite transaction + upsert + revision 409; empty `writeList` deletes the list (same-second force-clear); Node `DELETE` honors `?revision=` like the Worker; `/import` on Node; chart warm loop cleared on SIGTERM; Kugou/Kuwo charts over HTTPS.

**Play:** QQ/Kugou native resolve; ChKSz `api.chksz.com`; HTML error pages retryable; `warmTrack` respects `playToken`/`loadingPlay`; `loadCharts` uses `chartGen`; structural library 409 unions history instead of dropping this tab's plays.

## Do not add

- More theme/layout shells unless the user asks (15 × 73 is already a maintenance tax).
- Paid CF products (R2, paid KV, Image Resizing, Workers AI).
- Audio bodies on the Worker (keep 302 to CDN).
- A second in-app Access/token on the private Worker.

## Optional leftovers (not blocking)

| Item | Notes |
|------|--------|
| Further `player.ts` slices | Persist + lyric clock are out; more slices only if a hot path still re-renders the tree |
| Lighthouse a11y in CI | Flaky without a stable preview. `check:bundle` is the size gate (no SearchOverlay modulepreload; index gzip ≤ 70 KiB) |

## Verify

```bash
npm test && npm run typecheck && npm run lint && npm run build && npm run check:bundle
```
