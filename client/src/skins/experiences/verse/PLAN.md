# 词页 (verse) — lyrics-first experience

## Job
Lyrics are the main picture. Tap a line to seek. A mini transport (prev / play / next) stays on screen. Favorites, search, history, charts, and the queue are one tap away — as a library leaf, never a comment thread.

## Visual
A night reading room, not a player chrome clone.

- Typography-first: display serif for the verse, quiet sans for tools.
- Active line is a single lit stanza; neighbors recede.
- Cover art is a small ember in the dock, not a hero.
- Section keys read like a book index (词 / 搜 / 榜 / 列 / 藏 / 史), not a feed.

## Palettes (`theme.ts`)
Both `layout: "verse"`. Tokens match catalog `ThemeTokens` (minus layout union) so they can be wired later without reshaping.

| id | mood | ground | type | accent |
|---|---|---|---|---|
| `verse-dim` | muted dark | dusty charcoal `#161410` | aged paper | brass `#b89a6a` |
| `verse-deep` | saturated deep dark | indigo-black `#070414` | ivory | gold `#e8b86d` + rose `#c45c8a` |

`verse-dim` keeps chroma low (muted brass, no second punch). `verse-deep` pushes ink + gold/rose.

## Chrome (not SkinHead / TabNav)
`VerseLayout({ brand })` owns its own shell.

1. **Mast** — brand mark + `LocaleSwitcher` + `SkinSwitcher`.
2. **Stage** — `LyricsView variant="panel"` fills leftover viewport (`flex: 1; min-height: 0`). Parent is a flex column so the scroller can actually scroll and center the active line.
3. **Index keys** — one tap: lyrics / search / charts / playlist / favorites / history. Desktop (≥720px): vertical rail beside the verse. Phone: a row above the dock.
4. **Leaf sheet** — when `tab !== "lyrics"`, a page-turn panel (not a comment list) shows `SearchBar` + `TrackList`, or `ChartsPanel`. Close returns to the verse.
5. **Dock** (always) — `CoverImg` + title + custom prev / play / next (store) + `Transport compact` for the seek rail. Class `player-bar` so existing swipe-next still binds. Safe-area padded.

Mobile search uses `openMobileSearchFromGesture` (global `SearchOverlay`). Desktop search is the leaf + `SearchBar`.

## Layout / motion
- Root: `100%` / `100dvh`, `overflow: hidden`, `env(safe-area-inset-*)`.
- Only lyrics + sheet body scroll.
- Touch targets ≥44px (keys, transport, close, tools).
- `@media (max-width: 720px)` stacks rail under the verse; `@media (min-width: 721px)` (and `720px` comments / paired query) keeps rail + wider type.

## Allowed surface
Player, search, favorites, history, playlist, charts, lyrics, locale, theme switcher.

Do **not** add comments, social, video, VIP.

## Files
- `PLAN.md` — this document
- `VerseLayout.tsx` — `export function VerseLayout({ brand }: { brand: string })`
- `verse.css` — experience styles only
- `theme.ts` — `verse-dim` / `verse-deep`
- `i18n.ts` — verse chrome strings (zh + en); shared copy still uses `useT`

## Tests (`tests/experiences-verse.test.ts`, `tests/experiences-verse-layout.test.ts`)
Static + token imports. Assert: no SkinHead/TabNav; `LyricsView` panel; `720px` + `44px` + `dvh` + safe-area; both theme ids; layout `"verse"`; lyrics min-height 0; dock prev/play/next same 44px height on the title row; index keys + phone search launch 44px; leaf stays above the dock.

## Out of scope
Do not edit SkinHost, theme-catalog, layout-ids, App, global i18n, existing layouts, or package.json. Host wiring of `layout: "verse"` is a later catalog change.
