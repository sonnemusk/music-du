import { Transport } from "../../components/Transport";
import { usePlayer } from "../../store/player";
import { NowPlaying, SkinHead, TabNav, usePanelBody, useSearchOverlayBottom } from "./shared";

export function ImmersiveLayout({ brand }: { brand: string }) {
  useSearchOverlayBottom("calc(148px + env(safe-area-inset-bottom, 0px))");
  const body = usePanelBody();
  const curTrack = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  // Full-bleed background — original / large art (not list thumb)
  const bg = curTrack?.cover ? cover(curTrack.cover, "full") : "";

  return (
    <div className="layout layout-immersive">
      <div className="imm-bg" style={bg ? { backgroundImage: `url(${bg})` } : undefined} />
      <div className="imm-veil" />
      <div className="imm-shell">
        {/* same head row as every other layout */}
        <SkinHead brand={brand} tabs="none" />
        <div className="imm-stage">
          <div className="imm-now">
            <NowPlaying large />
            <Transport />
          </div>
          <div className="imm-sheet">
            <div className="skin-head__nav imm-sheet__nav">
              <TabNav short />
            </div>
            <div className="imm-body">{body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
