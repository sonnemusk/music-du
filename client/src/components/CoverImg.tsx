import { useLayoutEffect, useRef, useState } from "react";
import {
  coverProxyUrl,
  coverUrl,
  type CoverSize,
} from "../lib/player-core";

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

type Stage = "direct" | "proxy" | "empty";

/**
 * Cover image: direct CDN first (fast), then same-origin proxy, then empty.
 * NetEase hotlink works with referrerPolicy=no-referrer; proxy is fallback
 * when CDN edge fails or blocks.
 */
export function CoverImg({
  src,
  alt = "",
  className,
  priority,
  size = "thumb",
}: Props) {
  const direct = src ? coverUrl(src, size) : "";
  const proxy = src ? coverProxyUrl(src, size) : "";
  const [display, setDisplay] = useState(direct);
  const [stage, setStage] = useState<Stage>("direct");
  const stageRef = useRef<Stage>("direct");

  useLayoutEffect(() => {
    if (!src) {
      setDisplay("");
      setStage("empty");
      stageRef.current = "empty";
      return;
    }
    const d = coverUrl(src, size);
    setDisplay(d);
    setStage("direct");
    stageRef.current = "direct";
  }, [src, size]);

  // F-3: no per-row warmCoverFromRemote — list uses IntersectionObserver + warmTrackCovers

  if (!src || !display || stage === "empty") {
    const cls = [className || "cov", "cov--empty"].filter(Boolean).join(" ");
    return (
      <div className={cls} aria-hidden>
        ♪
      </div>
    );
  }

  return (
    <img
      key={`${stage}:${display}`}
      className={className || "cov"}
      src={display}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "auto"}
      referrerPolicy="no-referrer"
      onError={() => {
        if (stageRef.current === "direct" && proxy) {
          stageRef.current = "proxy";
          setStage("proxy");
          setDisplay(proxy);
          return;
        }
        stageRef.current = "empty";
        setStage("empty");
        setDisplay("");
      }}
    />
  );
}
