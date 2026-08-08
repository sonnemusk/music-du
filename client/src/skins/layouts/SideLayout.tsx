import { Transport } from "../../components/Transport";
import { NowPlaying, SkinHead, usePanelBody } from "./shared";

export function SideLayout({ brand }: { brand: string }) {
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
