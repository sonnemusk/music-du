import { LyricsView } from "../../components/LyricsView";
import { Transport } from "../../components/Transport";
import { usePlayer } from "../../store/player";
import { SkinHead, usePanelBody } from "./shared";

export function SplitLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const tab = usePlayer((s) => s.tab);
  const curTrack = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const quality = usePlayer((s) => s.quality);
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  const next = usePlayer((s) => s.next);

  const showList = tab !== "lyrics";

  return (
    <div className="layout layout-split">
      <SkinHead brand={brand} />
      {!showList ? (
        <section className="split-hero">
          <div className="split-cover">
            {curTrack?.cover ? (
              <img src={cover(curTrack.cover, "medium")} alt="" />
            ) : (
              <div className="ph">♪</div>
            )}
          </div>
          <div className="split-copy">
            <p className="eyebrow">
              {loadingPlay ? "切换中" : "NOW PLAYING"}
              {quality && quality !== "…" ? ` · ${String(quality).toUpperCase()}` : ""}
            </p>
            <h1>{curTrack?.name || "选一首歌"}</h1>
            <p className="by">{curTrack?.artist || "封面与歌词"}</p>
            <LyricsView variant="split" empty="播放后显示歌词" />
            <Transport />
            <div className="split-gestures">
              <button type="button" onClick={() => next(-1)}>
                ← 上一首
              </button>
              <button type="button" onClick={() => next(1)}>
                下一首 →
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="split-list">{body}</section>
      )}
    </div>
  );
}
