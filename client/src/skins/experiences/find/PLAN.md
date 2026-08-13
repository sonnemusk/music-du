# Find / 检索 — search-first experience

Open and search. The search field is the product. Hits become the play queue. Liked, history, charts, playlist, and lyrics exist only as drawers when a keyword fails — never as a recommendation waterfall.

## Job

- On mount: `setTab("search")`.
- Hero `SearchBar` on desktop **and** phone (search-first exception to the usual 🔍-only mobile chrome).
- Mobile search input `font-size: 16px` so iOS does not zoom.
- Overlay stays available as a second path (`openMobileSearchFromGesture`).
- Mini bar: cover + title + prev / play / next (shared `Transport`).
- Touch targets ≥ 44px. No page overflow. `100dvh` + safe-area insets.

## Palettes

| id | mood | notes |
|---|---|---|
| `find-dim` | muted dark | olive-ash, dusty brass, fog index |
| `find-deep` | saturated deep dark | ink indigo, amber ping, teal edge |

Both use `layout: "find"`. Tokens live in `theme.ts` (host catalog is out of scope for this slot).

## Visual idea — card catalog / locator

Not a player-first dock. Not a cover grid. A **locator instrument**:

- Display mark **FIND** / **检索** with a hairline index rule.
- One oversized search well. Quiet concentric rings behind it (desktop only).
- Result rows numbered like catalog cards (`TrackList mode="search"`).
- Status line: “N tracks · this list is the queue”.
- Fallback chips sit under the well, labeled “If you can't find it”. No auto-play feed, no related-artist tiles.

## Chrome (custom — no shared layout chrome)

```
[ FIND · brand ]                    [locale] [theme]
[ kicker ]
[ ████████████ SearchBar ████████ ] [overlay?]
[ queue status ]
[ drawers: liked · history · charts · playlist · lyrics ]
[ stage: TrackList | ChartsPanel | LyricsView          ]
[ mini: cover | title/artist | ⏮ ▶ ⏭  seek           ]
```

Phone (≤720px): same stack, tighter padding, SearchBar always on, drawers scroll sideways, mini bar + home-indicator inset.

## Reuse

`SearchBar`, `TrackList mode="search"`, `usePlayer.search` (via SearchBar), `Transport`, `SkinSwitcher`, `LocaleSwitcher`, `ChartsPanel`, `LyricsView`, `CoverImg`.

Do not use shared layout chrome. Do not add comments / social / video / VIP / algorithmic recommend.

## Files

- `PLAN.md` — this note
- `theme.ts` — `find-dim`, `find-deep`
- `i18n.ts` — experience copy (zh/en); shared keys stay in app locale
- `find.css` — shell, 720px breakpoint, 16px input, 44px targets, dvh/safe-area
- `FindLayout.tsx` — `export function FindLayout({ brand }: { brand: string })`
- `tests/experiences-find.test.ts` — static contract

## Risks

- Host still routes unknown layouts to the default shell. This slot must not patch `SkinHost` / catalog / layout-ids; wiring is a later change.
- `SearchBar` clears its draft when `tab !== "search"`. Hero stays visible; submit still calls `search()` and snaps back to the search tab.
- Global `bootstrap` defaults to favorites; mount `setTab("search")` marks the tab touched so bootstrap cannot yank the user back.
