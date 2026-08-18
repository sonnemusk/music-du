import { flushSync } from "react-dom";
import { usePlayer } from "../store/player";

/** Prefetch the overlay chunk so the first 🔍 still focuses in-gesture. */
export function preloadSearchOverlay() {
  return import("../components/SearchOverlay");
}

/** Call from 🔍 click: open + focus in the same user gesture (iOS keyboard). */
export function openMobileSearchFromGesture() {
  void preloadSearchOverlay();
  flushSync(() => {
    usePlayer.getState().openSearchOverlay();
  });
  const el = document.querySelector<HTMLInputElement>(".search-overlay__input");
  el?.focus({ preventScroll: true });
}
