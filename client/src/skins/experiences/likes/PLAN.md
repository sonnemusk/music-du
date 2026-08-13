# Likes / 收藏 — The Keep (匣)

Favorites-first skin. Open the app and the liked list is already the page. Tap a row to play it. A tray at the bottom keeps prev / play / next while you browse. Search, history, charts, lyrics, and the queue live in a spine (desktop) or a strip above the tray (phone). They never replace the home list unless you go there.

## Job

- On mount: `usePlayer.setTab("favorites")`.
- Home body: `TrackList` `mode="favorites"` — click plays, queue source follows favorites.
- Mini bar always on screen: cover, title, prev / play / next.
- Full `Transport` (seek, mode, quality, volume) sits in a sheet opened from the tray.
- Search: desktop `SearchBar` in the top row; phone 🔍 launches `SearchOverlay`.
- Locale + global `SkinSwitcher` in the tools cluster. Local dim/deep toggle for this skin’s palettes.
- Sections: favorites, search, history, charts, lyrics, playlist. Nothing else.

## Visual

A personal coffer, not a player stage and not a tabbed browser.

- **Mark** — wax-seal heart on a book-spine rail.
- **Type** — Instrument Serif for the “收藏” title; DM Sans for UI.
- **List** — lined rows; the playing row gets a blush edge, not a neon pill.
- **Tray** — frosted strip that sits in the safe-area, never covering the list scroll.

### Palettes (`layout: "likes"`)

| id | mood |
| --- | --- |
| `likes-dim` | muted dark — dusty rose on graphite velvet |
| `likes-deep` | saturated deep dark — garnet on ink |

## Chrome (not SkinHead / TabNav)

```
desktop ≥721
  spine (destinations + palette) | stage (tools + title + list)
  tray (mini bar)

phone ≤720
  top (mark + search launch + locale + skin)
  list
  dest strip
  tray
```

Height is `100dvh`. Padding uses `env(safe-area-inset-*)`. All hit targets ≥44px. Stage / list `min-height: 0` + `overflow: auto` so nothing spills.

`--search-overlay-bottom` is written on `:root` so the portaled overlay clears the tray.

## Reuse

`TrackList`, `Transport`, `SearchBar`, `SearchOverlay` (launch), `SkinSwitcher`, `LocaleSwitcher`, `ChartsPanel`, `LyricsView`, `CoverImg`, `usePlayer`.

Do not import `SkinHead`, `TabNav`, or other layout shells.

## Files

- `theme.ts` — `likes-dim` / `likes-deep` tokens + CSS vars
- `i18n.ts` — zh / en copy for this chrome only
- `likes.css` — layout, 720px split, 44px, dvh, safe-area
- `LikesLayout.tsx` — `export function LikesLayout({ brand }: { brand: string })`
- `tests/experiences-likes.test.ts` — static contract

## Tests

No SkinHead. `setTab("favorites")`. CSS mentions `720px` and `44px`. Theme ids `likes-dim` / `likes-deep`. `vitest` + `tsc -p tsconfig.client.json`.
