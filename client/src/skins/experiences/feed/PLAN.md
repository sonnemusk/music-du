# Feed · 竖滑

Full-screen cover reel. Swipe the card vertically to change the current **site queue** track — early 汽水 energy, but **no video and no comments**.

Unwired on purpose: SkinHost / theme-catalog / layout-ids stay untouched. This folder is the complete experience.

## Job

- One cover fills the stage. Swipe **up** → `next(+1)`. Swipe **down** → `next(-1)`.
- Queue source is **only** 收藏 / 历史 / 播放列表 / 榜单. Search is for finding a song, never the swipe queue.
- Search, lyrics, locale, and theme switching stay reachable.
- Desktop **and** phone. Visible prev / play / next in addition to swipe.
- Touch targets ≥ 44px. No overflow. `safe-area` + `dvh`.

## Visual

Cinema reel, not a player chrome clone and not a tabbed list.

- Cover is the product. Film-edge notches, grain, vignette. Title sits in a bottom gradient in the display face. Prev / play / next sit in a 44×44 dock row under the caption so they never overlap.
- Queue sources are a short glass chip row — four site lists, not a six-tab nav.
- Right edge: a thin **index rail** (position in the active queue).
- Current lyric line can sit on the cover as a caption; full lyrics open in the dock.
- **Desktop (≥1024)** — phone-like reel column + always-on dock (queue / lyrics / search results).
- **Tablet (721–1023)** — reel still leads; dock becomes a shorter side column.
- **Phone (≤720)** — true full-bleed reel. Search is the overlay lens. Dock is a bottom sheet.

### Palettes (`layout: "feed"`)

| id | mood | notes |
| --- | --- | --- |
| `feed-dim` | muted dark | graphite, dusty brass, Instrument Serif titles |
| `feed-deep` | saturated deep dark | ink violet, hot magenta / violet blooms, Syne |

Tokens follow `ThemeTokens` (`bg` / `fg` / `accent` / `card` / `wallpaper` / …). The layout also paints a few `--feed-*` extras (veil, grain, notch).

## Interaction

### Swipe (the point)

Pointer handlers on `.feed-reel` (touch + mouse):

1. Ignore `[data-no-swipe]` (chips, dock, transport, buttons).
2. Track `pointerdown` → `pointermove` (live `translateY` rubber-band).
3. On `pointerup`, if `|dy| ≥ 56` and `|dy| > 1.25 × |dx|`:
   - `dy < 0` (swipe up) → `usePlayer.next(+1)`
   - `dy > 0` (swipe down) → `usePlayer.next(-1)`
4. Desktop wheel on the reel is the same mapping (locked ~480ms).

Prev / play / next buttons on the card are the accessible path. `<Transport />` keeps seek, mode, favorite, quality, volume.

### Queue source

Chips call `setTab(src)` and then:

- if the current track is already in that list → `setState({ queueSource: src })` (do not restart)
- else if the list has tracks → `playTrack(list[0], { from: src })`
- charts also `loadCharts()`

If search play sets `queueSource: "search"`, a layout effect remaps to the first site list that contains the track (favorites → playlist → charts → history). Playing always writes history, so swipe never stays on search.

### Search / lyrics / theme

- Desktop: in-chrome `SearchBar`. Results open in the dock (`TrackList` mode `search`).
- Phone (≤720): 🔍 → `openMobileSearchFromGesture()`. `--search-overlay-bottom` reserved on `:root`.
- Lyrics chip / cover caption → `LyricsView` in the dock (sheet on phone).
- `LocaleSwitcher` + `SkinSwitcher` in the top tools (own chrome, not `SkinHead` / `TabNav`).

## Files

| path | role |
| --- | --- |
| `theme.ts` | `LAYOUT_ID`, `THEMES`, `LAYOUT_META`, CSS var helper |
| `i18n.ts` | feed-only zh / en (shared keys still come from `useT`) |
| `FeedLayout.tsx` | `export function FeedLayout({ brand }: { brand: string })` |
| `feed.css` | reel, chips, dock, 720 + 1024 (+ 390) |
| `PLAN.md` | this note |

Reuse only: `usePlayer.next`, `TrackList`, `ChartsPanel`, `LyricsView`, `Transport`, `SearchBar`, `SkinSwitcher`, `LocaleSwitcher`, `CoverImg`, `openMobileSearchFromGesture`, `ThemeTokens`.

Do **not** use `SkinHead` / `TabNav` / other layout shells as chrome. No comments, social, video, paid-tier, or daily-recommend surfaces.

## Tests (`tests/experiences-feed.test.ts`)

Static source checks:

- no `SkinHead`
- CSS contains `720px` and another breakpoint
- theme ids `feed-dim` / `feed-deep`, `layout: "feed"`
- TSX has swipe / pointer handlers
- controls declare `44px`
- `tsc -p tsconfig.client.json` (unwired SkinHost is OK)
