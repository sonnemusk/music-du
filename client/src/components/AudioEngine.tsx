import { useEffect, useRef } from "react";
import { usePlayer } from "../store/player";

/** Hidden shared audio element — skins never own media. */
export function AudioEngine() {
  const ref = useRef<HTMLAudioElement>(null);
  const setAudio = usePlayer((s) => s.setAudio);
  const tick = usePlayer((s) => s.tick);
  const next = usePlayer((s) => s.next);

  useEffect(() => {
    const el = ref.current;
    setAudio(el);
    // iOS remote / headphone transport reliability
    if (el) {
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("x-webkit-airplay", "allow");
    }
    return () => setAudio(null);
  }, [setAudio]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => tick();
    const onEnd = () => next(1);
    const onPlay = () => tick();
    const onPause = () => tick();
    // Buffering progress for seek bar (HTMLMediaElement.buffered)
    const onProgress = () => tick();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onTime);
    el.addEventListener("progress", onProgress);
    el.addEventListener("canplay", onProgress);
    el.addEventListener("canplaythrough", onProgress);
    el.addEventListener("loadeddata", onProgress);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onTime);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("canplay", onProgress);
      el.removeEventListener("canplaythrough", onProgress);
      el.removeEventListener("loadeddata", onProgress);
    };
  }, [tick, next]);

  return (
    // Do NOT use display:none — iOS Safari often drops remote / headphone
    // controls for hidden media elements. Keep a 1×1 off-screen player.
    <audio
      ref={ref}
      preload="auto"
      playsInline
      style={{
        position: "fixed",
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: "none",
        left: 0,
        bottom: 0,
        zIndex: -1,
      }}
    />
  );
}
