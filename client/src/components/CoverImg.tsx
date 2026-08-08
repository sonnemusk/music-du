import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { coverUrl, type CoverSize } from "../lib/player-core";
import { resolveCoverDisplayUrl, warmCoverFromRemote } from "../lib/cover-browser-cache";

type Props = {
  src?: string;
  alt?: string;
  className?: string;
  /** Prefer eager for now-playing */
  priority?: boolean;
  /**
   * thumb  — list rows (default)
   * medium — player / dock
   * full   — rare; prefer medium unless true full-bleed background
   */
  size?: CoverSize;
};

/**
 * Cover image with size-aware proxy + browser Cache Storage.
 * List uses thumb; now-playing uses medium — never pull multi‑MB originals into lists.
 */
export function CoverImg({
  src,
  alt = "",
  className,
  priority,
  size = "thumb",
}: Props) {
  const proxy = src ? coverUrl(src, size) : "";
  const [display, setDisplay] = useState(proxy);
  const blobRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!src) {
      setDisplay("");
      return;
    }
    setDisplay(coverUrl(src, size));
  }, [src, size]);

  useEffect(() => {
    if (!src) {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
      return;
    }
    const p = coverUrl(src, size);
    let alive = true;

    void (async () => {
      const u = await resolveCoverDisplayUrl(src, size);
      if (!alive) {
        if (u.startsWith("blob:")) URL.revokeObjectURL(u);
        return;
      }
      if (u.startsWith("blob:")) {
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = u;
        setDisplay(u);
      } else {
        setDisplay(u || p);
        warmCoverFromRemote(src, size);
      }
    })();

    return () => {
      alive = false;
    };
  }, [src, size]);

  useEffect(() => {
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, []);

  if (!src || !display) {
    return <div className={className || "cov"} aria-hidden />;
  }

  return (
    <img
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
