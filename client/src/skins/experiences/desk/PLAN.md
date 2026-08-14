# 台架 Desk — plan

Everyday desktop listening shell. NetEase / QQ Music / Spotify desktop grammar, not a copy of any existing layout chrome (`SkinHead`, `TabNav`, `SideLayout`, and siblings stay unused).

## Job

A computer-first “desk rack”: **left library rail + center list + full-width bottom transport**. Phone (≤720px) collapses to **scrollable list + mini bar + bottom nav**. Only on-site capabilities: play/pause, prev, next, seek, quality, loop/shuffle, volume, search + recent searches, favorites, history, playlist, multi-platform charts, lyrics, locale, theme switcher.

## Visual system

Two dark palettes, same `layout: "desk"`, different hues (not two greys).

| Token | `desk-dim` muted dark | `desk-deep` saturated deep |
| --- | --- | --- |
| Mood | Warm pewter / oak desk at dusk | Ink-navy console, teal phosphor |
| `bg` | `#1c1b18` | `#05141f` |
| Accent | Muted brass `#c4a574` | Saturated teal `#14d4c8` |
| Type | DM Sans, comfy, soft radius, raised | Space Grotesk, tight, sharp, flat |
| Surface | Lifted cards, warm 1px hairlines | Inset well, cyan hairlines, play glow |

Shared craft:

- Hairline separators, no neon blobs.
- Active rail item: 3px accent spine + tinted fill.
- Playing row: left accent bar + brass/teal title.
- Covers slightly rounded on dim, square on deep.
- Play is the only saturated disc; prev/next are quieter squares.

## Chrome

### Desktop (≥1025px)

CSS grid: `rail 228px | stage`, dock spans full width.

- **Rail**: brand mark + theme name + library nav only (search, charts, favorites, playlist, history, lyrics).
- **Stage head**: always-on `SearchBar` on the left; locale + `SkinSwitcher` on the right (search shrinks, tools stay visible). Search tab also shows recent-keyword chips (`loadRecentSearches` / `search()`).
- **Stage**: `TrackList` / `ChartsPanel` / `LyricsView` only. One scrollport (`min-height: 0`, `overflow: auto`).
- **Dock** (`.player-bar`): now-playing (cover + title + quality chip, click → `locateCurrentInList`) + full `Transport` (prev / play / next / mode / quality / fav / seek / volume). Prev / play / next never leave the dock.

### Tablet (≤1024px)

Rail collapses to 76px icon column (short labels under icons). Dock keeps prev / play / next; volume column compresses. Stage header still holds search + locale/theme (short labels).

### Phone (≤720px)

Column: top bar → list → mini bar → foot nav. `100dvh` + safe-area insets. `--search-overlay-bottom` written on `:root` so the portaled overlay clears chrome.

- **Top**: truncated brand, 44×44 search launch → `openMobileSearchFromGesture()` (overlay owns input ≥16px + recent searches). Locale + theme.
- **List**: same panels as desktop; search tab hidden from foot nav.
- **Mini bar**: cover + title, **prev / play / next always visible** (≥44×44). Compact `Transport` seek. Second row: mode, `QualityPicker`, mute + volume, favorite.
- **Foot nav**: charts, favorites, playlist, history, lyrics. Items ≥44px.

Coarse pointer: nav, search launch, play trio, extras ≥44px. Mobile inputs in this tree ≥16px (no iOS focus zoom).

## Feature map

| Capability | Desktop | Phone |
| --- | --- | --- |
| Play / pause / prev / next | Dock `Transport` | Mini-bar trio (store `togglePlay` / `next`) |
| Seek | `Transport` | `Transport compact` |
| Quality / mode / volume / fav | `Transport` | Mini extras |
| Search + recents | `SearchBar` + chips | Overlay via gesture |
| Charts / playlist / likes / history / lyrics | Rail → stage | Foot nav → stage |
| Locale / theme | Stage header (top-right) | Same |

No comments, social, daily mix, MV, VIP, notes, following, or profiles.

## Tokens & copy

- `theme.ts`: `LAYOUT_ID = "desk"`, `THEMES` = `desk-dim` + `desk-deep`, `LAYOUT_META` `{name, nameEn, blurb, blurbEn}`.
- Themes typed as `Omit<ThemeTokens,"layout"> & { layout: "desk" }` so `tsc` stays valid without editing `layout-ids`.
- `i18n.ts` owns desk-only chrome strings. TSX uses `useT` + desk dict — **no hardcoded CJK**.

## Files (only these)

- `PLAN.md` (this file)
- `DeskLayout.tsx` — `export function DeskLayout({ brand }: { brand: string })`
- `desk.css`
- `theme.ts`
- `i18n.ts`
- `tests/experiences-desk.test.ts`

SkinHost / catalog / layout-ids / App / global i18n are **not** edited. Unwired host is expected.

## Verify

- Files exist; TSX does not import SkinHead / TabNav / shared layouts.
- CSS contains `720px` and `1024px`; play controls declare `44px`.
- `THEMES` ids `desk-dim` / `desk-deep`, distinct `bg` hexes, `layout: "desk"`.
- `npx vitest run tests/experiences-desk.test.ts`
- `npx tsc -p tsconfig.client.json --noEmit`
