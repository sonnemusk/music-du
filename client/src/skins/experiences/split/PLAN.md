# 并听 — Split experience

Player and the current list stay on stage together. Changing 收藏 / 历史 / 搜索 / 榜单 / 列表 / 歌词 never leaves this desk.

## Visual idea

A **listening desk with a notebook spine**. Two surfaces share one seam:

- Left (or top): the instrument — cover, title, transport.
- Right (or below): the score — whatever section is live.
- Between them: a **spine** of section keys. Desktop labels run vertically (gutter type). Phone spine lies flat as a chip row.

This is not header-tabs chrome and not a revived Side/Split layout. The spine *is* the way you change rooms without walking out.

### Palettes

| id | mood | material |
| --- | --- | --- |
| `split-dim` | muted dark | Warm graphite, dusty ivory type, aged brass accent, sage secondary. Instrument Serif titles. Soft vignette, no neon. |
| `split-deep` | saturated deep dark | Abyssal teal-indigo, electric teal + indigo, sharp edges, Syne titles. Active spine glows. |

Both use `layout: "split"`. Tokens live in `theme.ts` and paint `--bg` / `--accent` / `--wallpaper` the same way the catalog does.

## Layout

### Desktop (≥721px) — two-pane

CSS grid: `player | spine | list`.

- Player column holds brand, locale + theme switchers, cover, metadata, **play / prev / next** (`Transport`).
- List column holds desktop `SearchBar` and the live section body.
- Both columns visible. No overlaying the list with the player.

### Tablet (≤1024px)

Same two-pane grid, narrower player, tighter spine. Still side-by-side.

### Phone (≤720px) — stacked

Column stack: compact player **on top**, horizontal spine, list **below**.

- Controls (transport, spine, search launch, tools) **≥44×44**.
- `100dvh`, root `overflow: hidden`, list pane is the only scroller.
- Safe-area insets on all sides — nothing sits under the home indicator or notch.
- Search is the existing mobile overlay (`openMobileSearchFromGesture`), not an inline SearchBar.

## Sections (in-place)

Order on the spine: 收藏 → 历史 → 搜索 → 榜单 → 列表 → 歌词.

| tab | body |
| --- | --- |
| favorites / history / playlist / search | `TrackList` |
| charts | `ChartsPanel` |
| lyrics | `LyricsView` |

Desktop search tab + always-on `SearchBar`. Phone search key opens the overlay and does not steal the return tab.

## Reuse (only)

`Transport`, `CoverImg`, `TrackList`, `ChartsPanel`, `LyricsView`, `SearchBar` + overlay helper, `SkinSwitcher`, `LocaleSwitcher`, `usePlayer`.

Own chrome: spine, desk, compact now-playing. **Not** `SkinHead` / `TabNav` / existing layout shells.

## Files

- `PLAN.md` — this note
- `SplitLayout.tsx` — `export function SplitLayout({ brand }: { brand: string })`
- `split.css` — desk, spine, 1024 / 720 rules, 44px hits
- `theme.ts` — `split-dim`, `split-deep`
- `i18n.ts` — experience copy (zh / en); tab labels stay in global `useT`
- `tests/experiences-split.test.ts`

## Tests

Static + token imports: no SkinHead; CSS includes `720px` and `1024px`; both theme ids; two-pane vs stacked rules; `44px`; `vitest` and `tsc -p tsconfig.client.json`.
