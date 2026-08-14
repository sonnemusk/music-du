export type Track = {
  id: string | number;
  name: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  level?: string;
  br?: number;
  size?: number;
};

export type Library = {
  playlist: Track[];
  favorites: Track[];
  history: Track[];
  curIdx: number;
  revision?: number;
};

export type PlaySource = {
  source: "remote" | "stream" | "none";
  url: string;
  level: string;
  br: number;
  size: number;
  name: string;
  artist: string;
  cover: string;
  sid: string;
  meta: Record<string, unknown> | null;
};

export type SkinId = "studio" | "glass" | "dock" | "focus";
