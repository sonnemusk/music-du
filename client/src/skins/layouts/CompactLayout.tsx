import { Transport } from "../../components/Transport";
import { NowPlaying, SkinHead, usePanelBody } from "./shared";
import { usePlayer } from "../../store/player";

export function CompactLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  return (
    <div className="layout layout-compact">
      <SkinHead brand={brand} tabs="short" />
      <div className={`compact-now ${loadingPlay ? "loading" : ""}`}>
        <div className="player-bar">
          <NowPlaying inline hideBadges />
          <div className="player-bar__controls">
            <Transport />
          </div>
        </div>
      </div>
      <main className="compact-main">{body}</main>
    </div>
  );
}
