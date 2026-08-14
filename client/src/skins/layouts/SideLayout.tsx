import { Transport } from "../../components/Transport";
import { NowPlaying, SkinHead, usePanelBody, useSearchOverlayBottom } from "./shared";

export function SideLayout({ brand }: { brand: string }) {
  useSearchOverlayBottom("calc(148px + env(safe-area-inset-bottom, 0px))");
  const body = usePanelBody();
  return (
    <div className="layout layout-side">
      <SkinHead brand={brand} />
      <main className="side-main">
        <aside className="side-player">
          <NowPlaying large />
          <Transport />
        </aside>
        <section className="side-panel">{body}</section>
      </main>
    </div>
  );
}
