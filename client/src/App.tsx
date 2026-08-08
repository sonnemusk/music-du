import { useEffect } from "react";
import { AudioEngine } from "./components/AudioEngine";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { MediaSession } from "./components/MediaSession";
import { Toast } from "./components/Toast";
import { getTheme } from "./skins/theme-catalog";
import { SkinHost } from "./skins/SkinHost";
import { usePlayer } from "./store/player";

export default function App() {
  const skin = usePlayer((s) => s.skin);
  const bootstrap = usePlayer((s) => s.bootstrap);
  const setSkinOpen = usePlayer((s) => s.setSkinOpen);
  const skinOpen = usePlayer((s) => s.skinOpen);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const meta = getTheme(skin);
    const el = document.querySelector('meta[name="theme-color"]');
    if (el) el.setAttribute("content", meta.themeColor);
    document.documentElement.dataset.skin = skin;
    document.documentElement.style.colorScheme = isLightTheme(meta.bg) ? "light" : "dark";
  }, [skin]);

  // Click outside theme panel to close
  // Panel is portaled to document.body (.skin-panel--portal), so it is NOT
  // inside .skin-switcher — must exclude both, or mousedown closes the panel
  // before the card's click fires (manual pick appears broken; cycle still works).
  useEffect(() => {
    if (!skinOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest(".skin-switcher")) return;
      if (t.closest(".skin-panel")) return;
      setSkinOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [skinOpen, setSkinOpen]);

  return (
    <div className="app-shell">
      <SkinHost skin={skin} />
      <AudioEngine />
      <KeyboardShortcuts />
      <MediaSession />
      <Toast />
    </div>
  );
}

function isLightTheme(bg: string): boolean {
  const hex = bg.trim();
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return false;
  let r = 0,
    g = 0,
    b = 0;
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16);
    g = parseInt(hex.slice(3, 5), 16);
    b = parseInt(hex.slice(5, 7), 16);
  }
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
