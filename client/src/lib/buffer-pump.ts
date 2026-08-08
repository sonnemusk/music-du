/**
 * Keep downloading the current track while the main <audio> is paused.
 *
 * Browsers often suspend media network loading on pause, so `audio.buffered`
 * freezes. We spin a separate muted preload element (and optional fetch→blob
 * when CORS allows) so buffering can continue offline the playhead.
 *
 * Free / client-only — no CF audio proxy.
 */

import { bufferedRatio } from "./player-core";
import { hasAudioBlob, putAudioBlob } from "./audio-cache";

export type BufferPumpProgress = {
  /** 0–1 combined estimate */
  ratio: number;
  source: "main" | "pump" | "blob";
};

type Pump = {
  audio: HTMLAudioElement;
  src: string;
  trackId: string;
  abort: AbortController;
  timer: ReturnType<typeof setInterval> | null;
};

let pump: Pump | null = null;
let lastReport = -1;

function disposePump() {
  if (!pump) return;
  const p = pump;
  pump = null;
  lastReport = -1;
  if (p.timer) clearInterval(p.timer);
  p.abort.abort();
  try {
    p.audio.removeAttribute("src");
    p.audio.load();
  } catch {
    /* */
  }
}

/**
 * Start (or refresh) background buffer for the playing track while paused.
 * `onProgress` is called when buffered ratio advances.
 */
export function startPausedBufferPump(opts: {
  trackId: string | number;
  /** Prefer the exact URL the main player is using */
  src: string;
  mainAudio?: HTMLAudioElement | null;
  level?: string;
  onProgress?: (p: BufferPumpProgress) => void;
}): void {
  const src = (opts.src || "").trim();
  const trackId = String(opts.trackId || "");
  if (!src || !trackId || typeof Audio === "undefined") return;
  // Already complete on main player
  if (opts.mainAudio && bufferedRatio(opts.mainAudio) >= 0.995) {
    opts.onProgress?.({ ratio: 1, source: "main" });
    return;
  }
  // Same pump already running for this track+src
  if (pump && pump.trackId === trackId && pump.src === src) return;

  disposePump();

  const abort = new AbortController();
  const audio = new Audio();
  audio.preload = "auto";
  audio.muted = true;
  // Keep element out of remote / lock-screen session
  try {
    audio.setAttribute("playsinline", "true");
  } catch {
    /* */
  }

  const report = (ratio: number, source: BufferPumpProgress["source"]) => {
    const r = Math.max(0, Math.min(1, ratio));
    if (r - lastReport < 0.008 && r < 0.995) return;
    lastReport = r;
    opts.onProgress?.({ ratio: r, source });
  };

  // Seed from main element
  if (opts.mainAudio) {
    report(bufferedRatio(opts.mainAudio), "main");
  }

  try {
    audio.src = src;
    audio.load();
  } catch {
    disposePump();
    return;
  }

  const onProg = () => {
    const mainR = opts.mainAudio ? bufferedRatio(opts.mainAudio) : 0;
    const pumpR = bufferedRatio(audio);
    report(Math.max(mainR, pumpR), pumpR >= mainR ? "pump" : "main");
  };

  audio.addEventListener("progress", onProg);
  audio.addEventListener("loadeddata", onProg);
  audio.addEventListener("canplaythrough", onProg);

  // Poll — some browsers fire few progress events while idle
  const timer = setInterval(onProg, 500);

  pump = { audio, src, trackId, abort, timer };

  // Optional: if we can fetch the body (same-origin or CORS), store full blob
  // so next resume / revisit is instant. Never required for progress UI.
  if (!src.startsWith("blob:") && !src.startsWith("data:")) {
    void (async () => {
      try {
        if (await hasAudioBlob(trackId)) {
          report(1, "blob");
          return;
        }
        const res = await fetch(src, {
          mode: "cors",
          credentials: "omit",
          signal: abort.signal,
          headers: { Accept: "audio/*,*/*" },
        });
        if (!res.ok) return;
        // Stream reader for progressive ratio when Content-Length known
        const total = Number(res.headers.get("Content-Length") || 0);
        if (res.body && total > 0 && typeof ReadableStream !== "undefined") {
          const reader = res.body.getReader();
          const chunks: BlobPart[] = [];
          let received = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.byteLength;
              report(Math.min(0.99, received / total), "blob");
            }
          }
          const blob = new Blob(chunks, {
            type: res.headers.get("Content-Type") || "audio/mpeg",
          });
          if (blob.size > 8 * 1024) {
            await putAudioBlob(trackId, blob, {
              level: opts.level,
              mime: blob.type,
            });
            report(1, "blob");
          }
        } else {
          const blob = await res.blob();
          if (blob.size > 8 * 1024) {
            await putAudioBlob(trackId, blob, {
              level: opts.level,
              mime: res.headers.get("Content-Type") || blob.type,
            });
            report(1, "blob");
          }
        }
      } catch {
        /* CORS / abort — pump audio element still helps HTTP cache */
      }
    })();
  }
}

export function stopPausedBufferPump(): void {
  disposePump();
}

export function isBufferPumpActive(): boolean {
  return pump != null;
}
