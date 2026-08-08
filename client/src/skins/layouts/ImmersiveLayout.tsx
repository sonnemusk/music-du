import { Transport } from "../../components/Transport";
import { usePlayer } from "../../store/player";
import { NowPlaying, SkinHead, TabNav, usePanelBody } from "./shared";

export function ImmersiveLayout({ brand }: { brand: string }) {
  const body = usePanelBody();
  const curTrack = usePlayer((s) => s.curTrack);
  const cover = usePlayer((s) => s.cover);
  const bg = curTrack?.cover ? cover(curTrack.cover) : "";

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
