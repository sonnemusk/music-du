# 舞台 Stage — experience plan

Player-first concert hall. Opening the app lands on a full-viewport stage floor: giant cover under a follow-spot, then huge prev / play / next as footlights. Nothing else is a home feed. Favorites, history, search, charts, lyrics, and the queue live in wings (desktop) or the orchestra pit (phone).

Unwired on purpose. `SkinHost`, `theme-catalog`, `layout-ids`, `App.tsx`, and shared `zh.ts` / `en.ts` stay untouched.

## First screen

1. Thin playbill rail: brand, locale, catalog skin switcher, dim/deep lighting toggle. Not `SkinHead`.
2. Proscenium + follow-spot. Large square cover (`CoverImg`, medium, priority) with a soft floor reflection.
3. Title + artist. Empty state uses `nowPlaying.pick`.
4. `Transport` with prev / play / next scaled into footlights. Play ≥ 44×44 (actually ~88). Seek + volume stay, but the trio dominates.
5. Apron cue chips: 收藏 / 历史 / 搜索 / 榜单 / 歌词 / 播放列表. Each is a ≥44px hit target. They open a sheet; they do not replace the stage.

Swipe can bind later via the `now-playing` class on the art block.

## How lists open

| Surface | Motion | Contents |
| --- | --- | --- |
| Desktop `min-width: 721px` | Right **wing** drawer (~400px) over a dimmed curtain | Active section + close |
| Phone `max-width: 720px` | Bottom **pit** sheet (~72dvh) | Same, handle + safe-area |
| Phone search | No sheet | `openMobileSearchFromGesture()` (scheme B overlay) |
| Desktop search | Wing sheet | `SearchBar` + `TrackList` |

Opening a cue calls `setTab`. Closing the sheet leaves the stage floor as the home view. Escape and curtain click dismiss. Search inputs are ≥16px.

## Palettes — layout `"stage"`

| id | Mood | bg | accent |
| --- | --- | --- | --- |
| `stage-dim` | House lights down. Warm muted charcoal, dusty gold footlight. | `#16130f` | `#c4a574` |
| `stage-deep` | Mid-show gels. Saturated ink-violet, hot magenta + gold spot. | `#120018` | `#ff2d6a` |

Tokens live in `theme.ts`. Layout applies CSS vars locally (`data-theme`). Dim/deep toggle persists to `kazam.v2.stageTheme`. Backgrounds must stay different.

## Files (only these)

- `PLAN.md` — this plan
- `StageLayout.tsx` — `export function StageLayout({ brand }: { brand: string })`
- `stage.css` — stage chrome, 720px split, 44px play, dvh + safe-area
- `theme.ts` — `stage-dim` / `stage-deep`
- `i18n.ts` — stage copy only (tabs/empty/search stay on shared `useT`)
- `tests/experiences-stage.test.ts`

## Reuse / do not use

Use: `usePlayer`, `Transport`, `CoverImg`, `TrackList`, `ChartsPanel`, `LyricsView`, `SearchBar`, `SkinSwitcher`, `LocaleSwitcher`, `openMobileSearchFromGesture` at ≤720px.

Do not use `SkinHead`, `TabNav`, or another layout as chrome. No comments, social, video, VIP, daily recommend.

## Responsive / a11y

- Root: `100%` / `100dvh`, `overflow: hidden`, `box-sizing: border-box`, safe-area padding.
- Floor flexes; cover `max-height` so transport never clips.
- Touch targets ≥44px. Coarse pointers keep seek 44px tall.
- Sheet is `role="dialog"`; cue buttons `aria-expanded`.
- `prefers-reduced-motion` kills sheet/spot motion.

## Tests

Static vitest (no SkinHost wire):

- `StageLayout` has no `SkinHead` / `TabNav`
- CSS mentions `720px` (phone sheet vs desktop wing)
- `stage-dim` and `stage-deep` have different `bg`
- Play control `min-width` / `min-height` ≥ 44px

Then `tsc -p tsconfig.client.json --noEmit`.

## Risks

- Experience is unwired: catalog / `SkinHost` do not list `stage`. QA must import `StageLayout` directly.
- `SkinSwitcher` still cycles catalog skins, not dim/deep. Lighting is a local toggle.
- Portaled theme/quality menus read `:root` tokens. Until hosted, they may miss stage vars.
- Global `.t-btn.play` rules (especially `pointer: coarse`) can shrink the footlight; stage CSS must out-specify them.
- `layouts.css` track-list paint is scoped to `.skin-host`. Sheet lists look correct only when a host (or this file) paints rows.
