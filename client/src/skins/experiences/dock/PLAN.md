# 泊位 (Dock) — plan

A phone-first listening shell. Interaction follows the habit of NetEase Cloud / QQ Music (bottom tabs + always-on mini bar + tap to board a full now-playing page). Content is only what this site already has.

Metaphor: the current track **berths** in a slip. Lists are the quay. Opening now-playing is **boarding**.

## Palettes (both dark, `layout: "dock"`)

| id | mood | hue | tokens (intent) |
| --- | --- | --- | --- |
| `dock-dim` | muted / low-sat dark | olive–taupe fog (not black) | dusty brass accent, flat surface, soft radius |
| `dock-deep` | saturated jewel dark | malachite water + aqua beacon (not navy) | jewel aqua / violet spark, glass surface, round radius |

Background hexes are different on purpose (`#2a2b28` vs `#061a16`).

## Breakpoints

- **Phone ≤720px:** header (brand + search launch + locale + theme) / scrolling content / **mini berth** / **bottom tabs**. Search uses `openMobileSearchFromGesture` (overlay z-index 900). Inputs ≥16px. Touch targets ≥44px on `(pointer: coarse)`.
- **Tablet 721–1023px:** real `SearchBar` in the header. Tabs become a horizontal rail under the header. Mini berth stays at the bottom. Sheet still used for seek / quality / mode / volume.
- **Desktop ≥1024px:** left rail (tabs + tools). Real `SearchBar` in the head. Mini berth grows a compact seek strip. Boarding sheet is a full-stage player with lyrics column.

## How each capability is reached

| Capability | Phone | Desktop / tablet |
| --- | --- | --- |
| Play / prev / next | Always on the mini berth. Also in the boarded `Transport`. | Same. Mini never hides these three. |
| Seek, quality, loop/shuffle, volume, like | One tap: board the sheet → shared `Transport`. | Same; desktop mini also shows compact seek. |
| Search + recent | Header spyglass → SearchOverlay (recent chips live there). | Header `SearchBar`. Search tab shows recent chips + `TrackList`. |
| Favorites | Bottom / rail tab → `TrackList` `favorites`. | Same. |
| Playlist (queue) | Tab → `TrackList` `playlist`. | Same. |
| History | Tab → `TrackList` `history`. | Same. |
| Multi-platform charts | Tab → `ChartsPanel`. | Same. |
| Lyrics (tap line to seek) | Tab → `LyricsView`. Also inside the boarded sheet. | Same; desktop sheet keeps a lyrics column. |
| Locale | Header `LocaleSwitcher`. | Header or rail `LocaleSwitcher`. |
| Theme | Header `SkinSwitcher` (panel z-index 2000). | Same. |

Not added: comments, social, daily recommend, MV, VIP, notes, following, profiles.

## Chrome (owned, not SkinHead / TabNav / stock layouts)

```
┌ head: brand · search · locale · theme ─────────────┐
│  [rail on ≥1024]     main list / charts / lyrics    │
├ mini berth: cover+title | (seek ≥1024) | ⏮ ▶ ⏭ ──┤
└ phone tabs: liked · queue · charts · lyrics · hist ┘
        ▲ tap cover/title → sheet (z-index 80)
```

- Mini bar uses class `player-bar` so existing swipe-to-skip still binds.
- Sheet uses class `now-playing`. z-index **80** — below search overlay **900**, below theme panel **2000**.
- `--search-overlay-bottom` on `:root` reserves mini + (on phone) tab bar + safe area.
- Shell is `100dvh` / `100%`, `overflow-x: hidden`, safe-area padding.

## Motion & copy

- Sheet rises with a short ease; reduced-motion = instant.
- Playing cover wears a slow pulse ring (no spin if reduced-motion).
- Extra strings live in `i18n.ts` under `shell` (zh + en). No CJK in TSX.

## Files

- `theme.ts` — `LAYOUT_ID`, `THEMES` (2), `LAYOUT_META`
- `DockLayout.tsx` — `DockLayout({ brand })`
- `dock.css` — berth chrome, 720 / 1024, 44px rules
- `i18n.ts` — `shell` keys + `useDockT`
- `tests/experiences-dock.test.ts` — static + theme assertions
