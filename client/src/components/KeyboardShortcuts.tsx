import { useEffect } from "react";
import { isEditableTarget } from "../lib/player-core";
import { usePlayer } from "../store/player";

/**
 * Global hotkeys (ignored while typing in inputs):
 * Space      play / pause
 * ← / →     seek ±5s
 * [/] or P/N prev / next
 * M          mute
 * F          favorite current
 * 1–3        cycle play mode (list/single/shuffle via repeated cycle? use L for mode)
 * L          cycle play mode
 * Esc        close theme panel
 */
export function KeyboardShortcuts() {
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const seekBy = usePlayer((s) => s.seekBy);
  const toggleMute = usePlayer((s) => s.toggleMute);
  const toggleFavorite = usePlayer((s) => s.toggleFavorite);
  const cycleMode = usePlayer((s) => s.cycleMode);
  const setSkinOpen = usePlayer((s) => s.setSkinOpen);
  const skinOpen = usePlayer((s) => s.skinOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      const key = e.key;

      if (key === " " || key === "Spacebar") {
        e.preventDefault();
        togglePlay();
        return;
      }
      if (key === "ArrowLeft") {
        e.preventDefault();
        seekBy(e.shiftKey ? -15 : -5);
        return;
      }
      if (key === "ArrowRight") {
        e.preventDefault();
        seekBy(e.shiftKey ? 15 : 5);
        return;
      }
      if (key === "[" || key === "p" || key === "P") {
        e.preventDefault();
        next(-1);
        return;
      }
      if (key === "]" || key === "n" || key === "N") {
        e.preventDefault();
        next(1);
        return;
      }
      if (key === "m" || key === "M") {
        e.preventDefault();
        toggleMute();
        return;
      }
      if (key === "f" || key === "F") {
        e.preventDefault();
        toggleFavorite();
        return;
      }
      if (key === "l" || key === "L") {
        e.preventDefault();
        cycleMode();
        return;
      }
      if (key === "Escape" && skinOpen) {
        e.preventDefault();
        setSkinOpen(false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    next,
    seekBy,
    toggleMute,
    toggleFavorite,
    cycleMode,
    setSkinOpen,
    skinOpen,
  ]);

  return null;
}
