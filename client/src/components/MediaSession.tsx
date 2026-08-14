import { useEffect } from "react";
import { coverProxyUrl } from "../lib/player-core";
import { usePlaybackClock } from "../store/playback-clock";
import { usePlayer } from "../store/player";

/**
 * Lock-screen / Control Center / Apple headphone remote (AVRCP).
 *
 * Critical for Safari / AirPods:
 * - Bind action handlers ONCE (do not null+rebind on every play/pause — that breaks remotes)
 * - Handlers always read fresh state via getState()
 * - Keep playbackState + positionState in sync with the real <audio>
 * - Artwork must be same-origin (CORS) → use cover-proxy, not bare CDN
 */
export function MediaSession() {
  const curTrack = usePlayer((s) => s.curTrack);
  const playing = usePlaybackClock((c) => c.playing);
  // F-1: do not subscribe to per-tick currentTime — throttle position from audio

  // Document title (separate from Media Session)
  useEffect(() => {
    if (curTrack?.name) {
      document.title = `${playing ? "▶ " : ""}${curTrack.name} · ${curTrack.artist || "Music"}`;
    } else {
      document.title = "Music";
    }
  }, [curTrack, playing]);

  // Action handlers — mount once only
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;

    const bind = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler
    ) => {
      try {
        ms.setActionHandler(action, handler);
      } catch {
        /* unsupported on this browser */
      }
    };

    const onPlay = () => {
      const s = usePlayer.getState();
      const a = s.audioEl;
      if (!a) return;
      // Prefer real element state over React flag (avoids stale/desync)
      if (a.paused) s.togglePlay();
    };

    const onPause = () => {
      const s = usePlayer.getState();
      const a = s.audioEl;
      if (!a) return;
      if (!a.paused) s.togglePlay();
    };

    const onNext = () => {
      usePlayer.getState().next(1);
    };

    /** Apple Music-like: long-press / prev — restart if >3s into track */
    const onPrev = () => {
      const s = usePlayer.getState();
      const a = s.audioEl;
      if (a && (a.currentTime || 0) > 3) {
        try {
          a.currentTime = 0;
        } catch {
          /* */
        }
        s.tick();
        if (a.paused) s.togglePlay();
        return;
      }
      s.next(-1);
    };

    const onSeekBack = () => usePlayer.getState().seekBy(-10);
    const onSeekFwd = () => usePlayer.getState().seekBy(10);

    const onSeekTo = (details: MediaSessionActionDetails) => {
      const s = usePlayer.getState();
      const a = s.audioEl;
      if (!a || details.seekTime == null || !isFinite(details.seekTime)) return;
      const d = a.duration || 0;
      if (d > 0) {
        a.currentTime = Math.max(0, Math.min(d, details.seekTime));
        s.tick();
      }
    };

    const onStop = () => {
      const s = usePlayer.getState();
      const a = s.audioEl;
      if (a && !a.paused) s.togglePlay();
      if (a) {
        try {
          a.currentTime = 0;
        } catch {
          /* */
        }
        s.tick();
      }
    };

    bind("play", onPlay);
    bind("pause", onPause);
    bind("previoustrack", onPrev);
    bind("nexttrack", onNext);
    bind("seekbackward", onSeekBack);
    bind("seekforward", onSeekFwd);
    bind("seekto", onSeekTo);
    bind("stop", onStop);

    return () => {
      for (const action of [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "seekto",
        "stop",
      ] as MediaSessionAction[]) {
        try {
          ms.setActionHandler(action, null);
        } catch {
          /* */
        }
      }
    };
  }, []);

  // Metadata when track changes
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!curTrack) {
      try {
        ms.metadata = null;
      } catch {
        /* */
      }
      return;
    }

    const artwork: MediaImage[] = [];
    if (curTrack.cover) {
      // Same-origin proxy required for Media Session artwork (CORS)
      const proxy = coverProxyUrl(curTrack.cover, "medium");
      if (proxy) {
        const abs = proxy.startsWith("http")
          ? proxy
          : `${location.origin}${proxy}`;
        artwork.push(
          { src: abs, sizes: "96x96", type: "image/jpeg" },
          { src: abs, sizes: "256x256", type: "image/jpeg" },
          { src: abs, sizes: "512x512", type: "image/jpeg" }
        );
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
  }, [curTrack]);

  // playbackState + positionState (needed for Control Center / headphones UI)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    try {
      ms.playbackState = playing ? "playing" : "paused";
    } catch {
      /* */
    }
  }, [playing]);

  // F-1: setPositionState at ~1Hz from the audio element (not React time ticks)
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const push = () => {
      try {
        const a = usePlayer.getState().audioEl;
        if (!a) return;
        const d = a.duration || 0;
        const pos = a.currentTime || 0;
        const rate = isFinite(a.playbackRate) && a.playbackRate > 0 ? a.playbackRate : 1;
        if (d > 0 && isFinite(d) && isFinite(pos)) {
          ms.setPositionState({
            duration: d,
            playbackRate: rate,
            position: Math.max(0, Math.min(pos, d)),
          });
        }
      } catch {
        /* NotSupportedError */
      }
    };
    push();
    const id = window.setInterval(push, 1000);
    return () => window.clearInterval(id);
  }, [curTrack?.id, playing]);

  return null;
}
