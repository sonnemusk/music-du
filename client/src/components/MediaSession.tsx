import { useEffect } from "react";
import { coverUrl } from "../lib/player-core";
import { usePlayer } from "../store/player";

/** Lock-screen / OS media keys + document title sync. */
export function MediaSession() {
  const curTrack = usePlayer((s) => s.curTrack);
  const playing = usePlayer((s) => s.playing);
  const togglePlay = usePlayer((s) => s.togglePlay);
  const next = usePlayer((s) => s.next);
  const seekBy = usePlayer((s) => s.seekBy);
  const audioEl = usePlayer((s) => s.audioEl);

  // Document title
  useEffect(() => {
    if (curTrack?.name) {
      document.title = `${playing ? "▶ " : ""}${curTrack.name} · ${curTrack.artist || "Music"}`;
    } else {
      document.title = "Music";
    }
  }, [curTrack, playing]);

  // Media Session API
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    if (curTrack) {
      const artwork: MediaImage[] = [];
      if (curTrack.cover) {
        const src = coverUrl(curTrack.cover, "medium");
        if (src) {
          artwork.push({ src: src.startsWith("http") ? src : `${location.origin}${src}`, sizes: "512x512", type: "image/jpeg" });
        }
      }
      try {
        ms.metadata = new MediaMetadata({
          title: curTrack.name || "Music",
          artist: curTrack.artist || "",
          album: curTrack.album || "Music",
          artwork,
        });
      } catch {
        /* older browsers */
      }
    }

    try {
      ms.playbackState = playing ? "playing" : "paused";
    } catch {
      /* */
    }

    const bind = (action: MediaSessionAction, handler: () => void) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    };

    bind("play", () => {
      if (!playing) togglePlay();
    });
    bind("pause", () => {
      if (playing) togglePlay();
    });
    bind("previoustrack", () => next(-1));
    bind("nexttrack", () => next(1));
    bind("seekbackward", () => seekBy(-10));
    bind("seekforward", () => seekBy(10));
    bind("stop", () => {
      if (playing) togglePlay();
      if (audioEl) {
        try {
          audioEl.currentTime = 0;
        } catch {
          /* */
        }
      }
    });

    return () => {
      for (const action of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "stop",
      ] as MediaSessionAction[]) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* */
        }
      }
    };
  }, [curTrack, playing, togglePlay, next, seekBy, audioEl]);

  return null;
}
