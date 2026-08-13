# 足迹 / Recents — experience plan

Open on **play history**. The first screen is a recency trail you can resume, not a generic tab page with a different header. A **mini transport bar stays on screen**. Favorites, search, charts, lyrics, and the queue live in this experience’s own navigation.

## Job

- Land on `history` (`setTab("history")` on mount).
- History reads as a **timeline / recents tape** (spine, now-node, receding steps).
- Still use shared `TrackList` (`mode="history"`) so play, locate, prefetch, fav, and remove stay identical.
- Mini bar always exposes **prev / play / next** (plus seek; extra chrome hides on the phone).
- Desktop **and** phone. Touch targets ≥ 44px. No horizontal overflow. `safe-area` + `dvh`.

## Hard boundary

Use only: player, search, favorites, history, playlist, charts, lyrics, locale, theme switcher.

Do **not** add comments, social, video, VIP.

Do **not** use `SkinHead` / `TabNav` as chrome. Invent the shell.

## Palettes (`theme.ts`)

| id | role | feel |
|---|---|---|
| `recent-dim` | muted dark | warm charcoal fog, dusty brass nodes, paper steps |
| `recent-deep` | saturated deep dark | indigo ink, electric blue / violet, glass steps |

Both declare `layout: "recent"`. Tokens follow the catalog shape (`bg`, `fg`, `accent`, `wallpaper`, fonts, radius, density, surface) so a later host can paint CSS vars the same way.

This slot does **not** register themes in `theme-catalog` / `SkinHost` / `layout-ids` (out of bounds).

## Layout (`RecentLayout.tsx`)

```
┌ rec-top ─ brand · search · locale · theme ─────────────┐
│ rec-stage                                              │
│  rec-rail (destinations)   rec-main                    │
│                            hero (history only)         │
│                            rec-body (TrackList / …)    │
├ rec-mini.player-bar ─ cover · title · Transport ───────┤
└────────────────────────────────────────────────────────┘
```

- **Mount:** `setTab("history")`.
- **Rail order:** history (home) → favorites → search → charts → playlist → lyrics.
- **History body:** `TrackList` in `.rec-body--history` — CSS turns rows into tape steps.
- **Other sections:** same primitives (`TrackList` / `ChartsPanel` / `LyricsView` / `SearchBar`).
- **Search:** desktop `SearchBar` in the top row; phone uses `openMobileSearchFromGesture()` (overlay is already mounted in `App`). Search stays in the rail.
- **Mini bar** uses class `player-bar` so existing swipe-to-skip binds without touching `App.tsx`. Cover tap opens lyrics.
- Copy for this skin lives in `i18n.ts` (zh + en). Shared strings (`tabs.*`, `empty.*`, `search.*`, `transport.*`) still come from `useT`.

## Visual system (`recent.css`)

Not a clone of side / compact / gallery.

- **Tape spine** on the left of history rows; first row is the **resume plate** (larger cover, lit node, “just now”); from the second row a faint “earlier” mark.
- Grain veil + receding opacity so older steps feel further away.
- **Desktop (≥1280):** labeled trail rail + wide tape.
- **Tablet (721–1023 / ≤1279):** icon rail, mini bar still in flow or tightened.
- **Phone (≤720):** top tools; tape fills the stage; **fixed mini bar** above a **fixed destination bar**; `--search-overlay-bottom` accounts for both + home indicator.
- Height: `100%` / `100dvh`, `min-width: 0`, list `overflow-y: auto`, root `overflow: hidden`.
- Hit targets: rail items, search launch, mini `t-btn`, locale/theme buttons → `min-height/min-width: 44px`.

## Files

- `PLAN.md` — this plan
- `RecentLayout.tsx` — `export function RecentLayout({ brand }: { brand: string })`
- `recent.css`
- `theme.ts` — `recent-dim`, `recent-deep`
- `i18n.ts` — experience copy
- `tests/experiences-recent.test.ts` — no SkinHead; setTab history; 720px+; theme ids; 44px

## Risks

- Themes / layout id are not in the catalog until a later wiring pass — switcher will not list them yet.
- History tracks have no timestamps; the tape is recency-by-index.
- First paint may still be the store default (`favorites`) until the mount effect runs.
- Search overlay inset is set via `:root:has(.layout-recent)` because the overlay is portaled to `body`.
