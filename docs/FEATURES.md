# Product features

Concise checklist of what ships in the current TypeScript app (v2).

## Playback

- Shared hidden `<audio>` (skins never own media)
- List / single / shuffle modes (default shuffle unless user overrides)
- Instant cut on track switch; sticky predicted next for shuffle
- Keyboard: Space, seek, prev/next, mute, favorite, mode
- Media Session (lock screen / headset controls)
- Volume + mute persisted in `localStorage`

## Resolve & warm

- Dual-layer song resolve cache (memory + `localStorage`, ~25 min durable)
- Background pre-resolve: search, charts, favorites, playlist, history
- Hover/focus row warm
- Play uses cache first; re-resolve only on miss or media error
- Next-track: resolve + hidden media warm + optional favorite IDB blob

## Library

- Playlist, favorites, history
- Node: SQLite under `data/`
- Cloudflare: optional free D1; else browser `localStorage`

## Discovery

- Keyword search
- Empty search → random Douyin chart track
- Multi-platform charts (soar / hot / new)

## Lyrics

- Multi-source server resolve
- Memory + `localStorage` cache (skip network on hit)
- Auto center-scroll; click line to seek

## UI

- **73** theme tokens × **15** layout shells (10 listen-first experiences + pocket + side / immersive / compact / gallery)
- Default skin: `stage-dim`
- Layouts load with `React.lazy` (unused shells stay out of the first JS pack)
- Cover proxy + browser Cache Storage
- Phone: 🔍 opens SearchOverlay; quality chip stays tappable on the mini bar
- Long lists window-render (≥80 rows)
- Theme switcher (desktop panel / mobile drawer)

## Deploy targets

- Node + Caddy (or any reverse proxy)
- Cloudflare Workers + Assets (free-tier policy: no audio edge cache)
