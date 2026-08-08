import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { coverUrl } from "../lib/player-core";
import { resolveCoverDisplayUrl, warmCoverFromRemote } from "../lib/cover-browser-cache";

type Props = {
  src?: string;
  alt?: string;
  className?: string;
  /** Prefer eager for now-playing */
  priority?: boolean;
};

/**
 * Cover image with browser Cache Storage warm.
 *
 * Critical for track switches: never keep the previous song's bitmap.
 * - `src` change → sync reset to new proxy (layout effect, before paint)
 * - `key` on <img> forces a fresh element so browsers don't paint the old frame
 * - optional Cache Storage blob for instant hit after warm
 */
export function CoverImg({ src, alt = "", className, priority }: Props) {
  const proxy = src ? coverUrl(src) : "";
  const [display, setDisplay] = useState(proxy);
  const blobRef = useRef<string | null>(null);

  // Before paint: drop any stale display when track/cover URL changes
  useLayoutEffect(() => {
    if (!src) {
      setDisplay("");
      return;
    }
    setDisplay(coverUrl(src));
  }, [src]);

  useEffect(() => {
    if (!src) {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      return;
    }
    const p = coverUrl(src);
    let alive = true;

    void (async () => {
      const u = await resolveCoverDisplayUrl(src);
      if (!alive) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
        return;
      }
      if (u.startsWith("blob:")) {
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = u;
        setDisplay(u);
      } else {
        // Still on this src? show proxy / resolved URL (never leave old song)
        setDisplay(u || p);
        warmCoverFromRemote(src);
      }
    })();

    return () => {
      alive = false;
    };
  }, [src]);

  // Unmount: free last blob
  useEffect(() => {
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, []);

  if (!src || !display) return <div className={className || "cov"} aria-hidden />;

  return (
    <img
      // Force new element per cover URL — prevents "wrong album for a few seconds"
      key={proxy}
      className={className || "cov"}
      src={display}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}
