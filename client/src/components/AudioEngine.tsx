import { useEffect, useRef } from "react";
import { usePlayer } from "../store/player";

/** Hidden shared audio element — skins never own media. */
export function AudioEngine() {
  const ref = useRef<HTMLAudioElement>(null);
  const setAudio = usePlayer((s) => s.setAudio);
  const tick = usePlayer((s) => s.tick);
  const next = usePlayer((s) => s.next);

  useEffect(() => {
    setAudio(ref.current);
    return () => setAudio(null);
  }, [setAudio]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onTime = () => tick();
    const onEnd = () => next(1);
    const onPlay = () => tick();
    const onPause = () => tick();
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnd);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("loadedmetadata", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("loadedmetadata", onTime);
    };
  }, [tick, next]);

  return (
    <audio
      ref={ref}
      preload="metadata"
      playsInline
      style={{ display: "none" }}
    />
  );
}
