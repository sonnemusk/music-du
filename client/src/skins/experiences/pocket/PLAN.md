# 袋 (pocket) — phone-first now-playing

## Job
Two mobile skins to try. Cover and lyrics share the **same page**. Tap the cover (or the 封面 / 歌词 switch) to flip. There is no floating sheet and no close button on lyrics.

Lists are real pages. The mini bar takes you back to now-playing — it does not open a dialog.

## Visual
Two palettes, one shell.

| id | mood |
| --- | --- |
| `pocket-paper` | Rice-paper light. Serif titles, floating cover, terracotta. |
| `pocket-ink` | Ink field + gold. Cover bleed, current line under the art, then the verse fills the stage. |

## Chrome (not SkinHead / TabNav)
1. **Mast** — mark, search (desktop `SearchBar` / phone overlay), paper/ink toggle, locale, theme.
2. **Now** — cover and `LyricsView` in one stage. Face switch is a segmented control, not a modal. On the cover page (not just the art), swipe up / down changes track (same as feed). Desktop stacks cover + title + transport at the top of the left column; lyrics stretch the right column.
3. **Library** — playlist / likes / charts / history as a full page.
4. **Tabs** — 播 / 列 / 藏 / 榜 / 史. Search is the header lens on phone.
5. **Mini** — only while browsing a list. Cover + title + prev / play / next. Class `player-bar`.

## Layout
- Root `100%` / overflow hidden / `env(safe-area-inset-*)`.
- Phone ≤720: one face at a time. Desktop ≥721: left rail (播 / 列 / 藏 / 榜 / 史) and cover | lyrics columns. Face switch is phone-only.
- Hits ≥44px. `720px` + `390px` + `dvh`.
- Lyrics live in-flow (`min-height: 0`). Never `position: fixed` / `role="dialog"`.

## Allowed surface
Player, search, favorites, history, playlist, charts, lyrics, locale, theme.

Do **not** add comments, social, video, VIP.
