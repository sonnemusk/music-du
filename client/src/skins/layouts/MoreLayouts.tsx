/**
 * 15 additional layouts — each a distinct information architecture.
 * Existing: side / dock / immersive / split / compact (separate files).
 */
import { Transport } from "../../components/Transport";
import { LyricsView } from "../../components/LyricsView";
import { usePlayer } from "../../store/player";
import {
  NowPlaying,
  SkinHead,
  TABS,
  TabNav,
  usePanelBody,
} from "./shared";

function useCoverBg() {
  const cur = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  return cur?.cover ? cover(cur.cover) : "";
}

/** 6 · stack — big cover on top, transport, then scrollable list */
export function StackLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  return (
    <div className="layout layout-stack">
      <SkinHead brand={brand} tabs="short" />
      <section className="stack-hero">
        <NowPlaying large />
        <Transport />
      </section>
      <main className="stack-body">{body}</main>
    </div>
  );
}

/** 7 · theater — lyrics dominate center stage */
export function TheaterLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const bg = useCoverBg();
  return (
    <div className="layout layout-theater">
      <div className="theater-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
      <div className="theater-veil" />
      <SkinHead brand={brand} tabs="none" />
      <div className="theater-stage">
        <div className="theater-lyrics">
          {tab === "lyrics" ? (
            <LyricsView variant="panel" empty="点播后显示歌词舞台" />
          ) : (
            <div className="theater-alt">{body}</div>
          )}
        </div>
        <aside className="theater-side">
          <NowPlaying />
          <Transport />
          <div className="theater-tabs">
            <TabNav short />
            <button type="button" className="theater-ly-btn" onClick={() => setTab("lyrics")}>
              回到歌词
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** 8 · rail — vertical icon rail left */
export function RailLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  return (
    <div className="layout layout-rail">
      <nav className="rail-nav" aria-label="主导航">
        <div className="rail-brand" title={brand}>
          M
        </div>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? "on" : ""}
            title={t.label}
            onClick={() => setTab(t.id)}
          >
            <span className="rail-ico">{t.short}</span>
            <span className="rail-lbl">{t.label}</span>
          </button>
        ))}
      </nav>
      <div className="rail-main">
        <SkinHead brand={brand} tabs="none" />
        <div className="rail-content">
          <aside className="rail-player">
            <div className="player-bar player-bar--stack">
              <NowPlaying inline />
              <div className="player-bar__controls">
                <Transport />
              </div>
            </div>
          </aside>
          <section className="rail-panel">{body}</section>
        </div>
      </div>
    </div>
  );
}

/** 9 · magazine — editorial huge type */
export function MagazineLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const cur = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const loading = usePlayer((s) => s.loadingPlay);
  return (
    <div className="layout layout-magazine">
      <SkinHead brand={brand} tabs="short" />
      <article className="mag-hero">
        <div className="mag-kicker">{loading ? "切换中" : "NOW PLAYING"}</div>
        <h1 className="mag-title">{cur?.name || "选一首歌"}</h1>
        <p className="mag-byline">{cur?.artist || "—"}</p>
        <div className="mag-row">
          <div className="mag-cover">
            {cur?.cover ? <img src={cover(cur.cover)} alt="" /> : <span>♪</span>}
          </div>
          <div className="mag-controls">
            <Transport />
          </div>
        </div>
      </article>
      <main className="mag-body">{body}</main>
    </div>
  );
}

/** 10 · card — single floating player card centered */
export function CardLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  return (
    <div className="layout layout-card">
      <SkinHead brand={brand} tabs="short" />
      <div className="card-stage">
        <div className="card-player">
          <NowPlaying large />
          <Transport />
        </div>
        {tab !== "lyrics" ? (
          <div className="card-list-wrap">{body}</div>
        ) : (
          <div className="card-list-wrap card-lyrics">{body}</div>
        )}
      </div>
    </div>
  );
}

/** 11 · grid — cover wall + compact player bar (not a stretched 3-zone header) */
export function GridLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  return (
    <div className="layout layout-grid">
      <SkinHead brand={brand} />
      <div className="grid-top">
        <div className="player-bar">
          <NowPlaying inline hideBadges />
          <div className="player-bar__controls">
            <Transport />
          </div>
        </div>
      </div>
      <main className="grid-wall">{body}</main>
    </div>
  );
}

/** 12 · strip — full list, sticky bottom player bar */
export function StripLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const cur = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const playing = usePlayer((s) => s.playing);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  return (
    <div className="layout layout-strip">
      <SkinHead brand={brand} />
      <main className="strip-body">{body}</main>
      <footer className="strip-bar">
        <div className="strip-cov">
          {cur?.cover ? <img src={cover(cur.cover)} alt="" /> : <span>♪</span>}
        </div>
        <div className="strip-meta">
          <div className="n">{cur?.name || "未在播放"}</div>
          <div className="a">{cur?.artist || ""}</div>
        </div>
        <div className="strip-transport">
          <button type="button" onClick={() => next(-1)} title="上一首">
            ‹
          </button>
          <button type="button" className="play" onClick={() => togglePlay()} title="播放/暂停">
            {playing ? "⏸" : "▶"}
          </button>
          <button type="button" onClick={() => next(1)} title="下一首">
            ›
          </button>
        </div>
        <div className="strip-seek">
          <Transport compact />
        </div>
      </footer>
    </div>
  );
}

/** 13 · poster — full-height cover column */
export function PosterLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const cur = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  return (
    <div className="layout layout-poster">
      <div className="poster-art">
        {cur?.cover ? (
          <img src={cover(cur.cover)} alt="" />
        ) : (
          <div className="poster-ph">♪</div>
        )}
        <div className="poster-overlay">
          <h1>{cur?.name || "Music"}</h1>
          <p>{cur?.artist || brand}</p>
          <Transport />
        </div>
      </div>
      <div className="poster-side">
        <SkinHead brand={brand} tabs="short" />
        <main className="poster-body">{body}</main>
      </div>
    </div>
  );
}

/** 14 · focus — only current track, list is secondary drawer-ish */
export function FocusLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const showList = tab !== "lyrics";
  return (
    <div className="layout layout-focus">
      <SkinHead brand={brand} tabs="none" />
      <div className="focus-center">
        <NowPlaying large />
        <Transport />
        <div className="focus-actions">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "on" : ""}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {showList ? <div className="focus-drawer">{body}</div> : <div className="focus-drawer lyrics">{body}</div>}
    </div>
  );
}

/** 15 · library — dense library browser */
export function LibraryLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  return (
    <div className="layout layout-library">
      <SkinHead brand={brand} />
      <div className="lib-shell">
        <header className="lib-mini">
          <div className="player-bar player-bar--dense">
            <NowPlaying inline hideBadges />
            <div className="player-bar__controls">
              <Transport compact />
            </div>
          </div>
        </header>
        <main className="lib-table">{body}</main>
      </div>
    </div>
  );
}

/** 16 · cinematic — letterbox / film frame */
export function CinematicLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const bg = useCoverBg();
  const cur = usePlayer((s) => s.curTrack);
  return (
    <div className="layout layout-cinematic">
      <div className="cine-bar top" />
      <div className="cine-frame">
        <div className="cine-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
        <div className="cine-veil" />
        <SkinHead brand={brand} tabs="short" />
        <div className="cine-center">
          <p className="cine-label">FEATURED TRACK</p>
          <h1>{cur?.name || "—"}</h1>
          <p className="cine-artist">{cur?.artist || ""}</p>
          <Transport />
        </div>
        <div className="cine-list">{body}</div>
      </div>
      <div className="cine-bar bottom" />
    </div>
  );
}

/** 17 · zen — ultra minimal */
export function ZenLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const setTab = usePlayer((s) => s.setTab);
  const cur = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const playing = usePlayer((s) => s.playing);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const listOpen = tab === "favorites" || tab === "playlist" || tab === "search" || tab === "charts" || tab === "history";
  return (
    <div className="layout layout-zen">
      <div className="zen-tools">
        <span className="zen-brand">{brand}</span>
        <button type="button" onClick={() => setTab(listOpen ? "lyrics" : "favorites")}>
          {listOpen ? "收起" : "曲库"}
        </button>
        <div className="zen-switch">
          {/* theme tools via head fragment */}
        </div>
      </div>
      <SkinHead brand={brand} tabs="none" />
      <div className="zen-core">
        <button type="button" className="zen-disc" onClick={() => togglePlay()} title="播放/暂停">
          {cur?.cover ? <img src={cover(cur.cover)} alt="" /> : <span>♪</span>}
        </button>
        <h1>{cur?.name || "静"}</h1>
        <p>{cur?.artist || ""}</p>
        <div className="zen-btns">
          <button type="button" onClick={() => next(-1)}>
            上一首
          </button>
          <button type="button" className="main" onClick={() => togglePlay()}>
            {playing ? "暂停" : "播放"}
          </button>
          <button type="button" onClick={() => next(1)}>
            下一首
          </button>
        </div>
        <div className="zen-seek">
          <Transport compact />
        </div>
      </div>
      {listOpen ? <div className="zen-list">{body}</div> : null}
    </div>
  );
}

/** 18 · console — multi-panel dashboard */
export function ConsoleLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const lyrics = usePlayer((s) => s.lyrics);
  return (
    <div className="layout layout-console">
      <SkinHead brand={brand} tabs="short" />
      <div className="console-grid">
        <section className="console-a">
          <div className="console-label">PLAYER</div>
          <NowPlaying />
          <Transport />
        </section>
        <section className="console-b">
          <div className="console-label">QUEUE / LIBRARY</div>
          <div className="console-scroll">{body}</div>
        </section>
        <section className="console-c">
          <div className="console-label">LYRICS</div>
          <div className="console-scroll">
            {lyrics.length ? (
              <LyricsView variant="panel" />
            ) : (
              <div className="empty">暂无歌词</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

/** 19 · sheet — player top, bottom sheet list */
export function SheetLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const bg = useCoverBg();
  return (
    <div className="layout layout-sheet">
      <div className="sheet-hero" style={bg ? { backgroundImage: `url(${bg})` } : undefined}>
        <div className="sheet-hero-veil" />
        <SkinHead brand={brand} tabs="none" />
        <div className="sheet-player">
          <NowPlaying large />
          <Transport />
        </div>
      </div>
      <div className="sheet-drawer">
        <div className="sheet-handle" />
        <div className="sheet-tabs">
          <TabNav short />
        </div>
        <div className="sheet-body">{body}</div>
      </div>
    </div>
  );
}

/** 20 · mosaic — asymmetric bento */
export function MosaicLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const cur = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const quality = usePlayer((s) => s.quality);
  return (
    <div className="layout layout-mosaic">
      <SkinHead brand={brand} tabs="short" />
      <div className="mosaic-bento">
        <div className="mosaic-tile mosaic-cover">
          {cur?.cover ? <img src={cover(cur.cover)} alt="" /> : <span className="ph">♪</span>}
        </div>
        <div className="mosaic-tile mosaic-meta">
          <span className="eyebrow">{quality || "MUSIC"}</span>
          <h1>{cur?.name || "—"}</h1>
          <p>{cur?.artist || brand}</p>
        </div>
        <div className="mosaic-tile mosaic-transport">
          <Transport />
        </div>
        <div className="mosaic-tile mosaic-list">{body}</div>
      </div>
    </div>
  );
}
