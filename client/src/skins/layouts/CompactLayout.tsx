import { QualityPicker } from "../../components/QualityPicker";
import { Transport } from "../../components/Transport";
import { NowPlaying, SkinHead, usePanelBody, useSearchOverlayBottom } from "./shared";
import { usePlayer } from "../../store/player";

export function CompactLayout({ brand }: { brand: string }) {
  useSearchOverlayBottom("calc(136px + env(safe-area-inset-bottom, 0px))");
  const body = usePanelBody();
  const loadingPlay = usePlayer((s) => s.loadingPlay);
  return (
    <div className="layout layout-compact">
      <SkinHead brand={brand} tabs="short" />
      <div className={`compact-now ${loadingPlay ? "loading" : ""}`}>
        <div className="player-bar">
          <NowPlaying inline hideBadges />
          <div className="player-bar__controls">
            <QualityPicker className="quality-wrap--keep" />
            <Transport />
          </div>
        </div>
      </div>
      <main className="compact-main">{body}</main>
    </div>
  );
}
