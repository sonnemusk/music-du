# Boards / 榜单

Homepage **is** the site’s existing multi-platform charts (抖音 / 网易 / QQ / 酷狗 · 飙升 / 热歌 / 新歌). One tap plays; the mini bar follows. There is no “为你推荐” — that data does not exist.

## Job

- On mount: `setTab("charts")`. `ChartsPanel` already calls `loadCharts`.
- Invent chrome around `ChartsPanel`. Do **not** use `SkinHead` / `TabNav` / existing layouts as chrome.
- Reuse only: `ChartsPanel`, `TrackList`, `Transport` (mini bar), `SearchBar` + overlay launch, `SkinSwitcher`, `LocaleSwitcher`, `LyricsView`, `CoverImg`, `usePlayer`.
- Allowed surfaces: player, search, favorites, history, playlist, charts, lyrics, locale, theme. No comments/social/video/VIP/fake feeds.

## Visual idea — stadium scoreboard

A dark ranking wall, not a player-first shell and not a gallery rail.

1. **Mast** — LED wordmark (榜单 / BOARDS) + live chart name, desktop `SearchBar`, phone 🔍 → `openMobileSearchFromGesture`, locale + theme.
2. **Section plates** — home `charts` plus favorites / history / playlist / lyrics. Large stadium-section chips, never 1-glyph cramped tabs.
3. **Stage** — `ChartsPanel` on land; `TrackList` / `LyricsView` for the other plates. Rank numerals are the hero (tabular, oversized, brass/gold top 3).
4. **Mini ticker** — `player-bar` so swipe-next still binds: cover, title, `Transport` prev / play / next. Phone hides volume + extra ghosts; keep 44px transport.

Desktop (≥720px): mast + section row + ranked list + ticker.  
Phone: compact mast, horizontal 44px plates, horizontal 44px chart chips (scroll, no wrap-cram), ticker above safe-area.

## Palettes (`layout: "boards"`)

| id | mood | tokens |
| --- | --- | --- |
| `boards-dim` | muted dark | charcoal `#14161a`, warm paper fg, dusty brass `#b89a6a`, sage secondary, flat/comfy/soft |
| `boards-deep` | saturated deep dark | plum-black `#07040c`, hot amber `#ff7a18` + rose `#ff2d6a`, raised/tight/sharp |

CSS scopes extras with `[data-skin="boards-dim"|"boards-deep"]` and `data-palette`. Tokens live in `theme.ts` for a later catalog merge (this slot does not edit `theme-catalog` / `SkinHost`).

## Layout contract

```
.layout-boards
  header.boards-mast     brand · search/launch · LocaleSwitcher · SkinSwitcher
  nav.boards-dest        section plates (not TabNav)
  main.boards-stage      ChartsPanel | TrackList | LyricsView
  footer.boards-mini.player-bar   CoverImg + meta + Transport
```

- Height: `100%` / `100dvh`, `overflow: hidden`; stage is the only scroller.
- Safe-area on mast top + mini bottom. `--search-overlay-bottom` on `:root:has(.layout-boards)` so the portaled overlay clears the ticker.
- Chart chips (`.charts-chip`) ≥44×44, padding not cramped; dest plates same.
- `data-no-swipe` on dest / chip rows.

## i18n

Local `i18n.ts` (do not edit `zh.ts` / `en.ts`): wordmark, kicker, dest aria, search launch, empty now-playing. Tab / empty / search / transport strings stay on `useT`.

## Tests

Static: no `SkinHead`; uses `ChartsPanel`; `setTab("charts")`; CSS includes `720px` and `44px`; themes `boards-dim` / `boards-deep` with `layout: "boards"`. Then `vitest` + `tsc -p tsconfig.client.json`.
