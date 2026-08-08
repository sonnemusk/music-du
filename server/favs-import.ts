/**
 * Favorites import parsing + name-match scoring.
 *
 * Modes:
 * 1) Exact: /favs export JSON { favorites: [{ id, name, artist, ... }] }
 * 2) Loose: plain text / CSV lines — "歌名" or "歌名 - 作者" / "歌名\t作者"
 * 3) Loose JSON: array of { name, artist? } or { id, name, ... }
 *
 * Name-only / name+artist rows need search match (see matchNameQuery).
 */

export type FavsExportTrack = {
  id: string | number;
  name: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
};

/** Row that already has a NetEase id (no search). */
export type ExactImportRow = FavsExportTrack & { kind: "exact" };

/** Row that needs search match. */
export type NameImportRow = {
  kind: "name";
  name: string;
  artist: string;
  query: string;
};

export type ImportRow = ExactImportRow | NameImportRow;

export type ParseImportResult =
  | { ok: true; mode: "exact" | "name" | "mixed"; rows: ImportRow[] }
  | { ok: false; error: string };

export type ParseFavsResult =
  | { ok: true; tracks: FavsExportTrack[] }
  | { ok: false; error: string };

function clean(s: string): string {
  return String(s || "")
    .replace(/\s+/g, " ")
    .replace(/[（(].*?[）)]/g, "")
    .trim();
}

/** True if object looks like our /favs export. */
export function isFavsExportShape(raw: unknown): raw is {
  favorites: unknown[];
  exportedAt?: string;
  source?: string;
  count?: number;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  return Array.isArray(o.favorites);
}

export function parseFavsExportJson(raw: unknown): ParseFavsResult {
  if (!isFavsExportShape(raw)) {
    return {
      ok: false,
      error: "格式不对：请使用 /favs 导出的 JSON（需含 favorites 数组）",
    };
  }
  const out: FavsExportTrack[] = [];
  const seen = new Set<string>();
  for (const t of raw.favorites) {
    if (!t || typeof t !== "object") continue;
    const row = t as Record<string, unknown>;
    if (row.id == null || row.id === "") continue;
    const k = String(row.id);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      id: /^\d+$/.test(k) ? Number(k) : (row.id as string | number),
      name: String(row.name ?? ""),
      artist: String(row.artist ?? ""),
      album: String(row.album ?? ""),
      cover: String(row.cover ?? ""),
      duration: Number(row.duration ?? 0) || 0,
    });
  }
  if (!out.length) {
    return { ok: false, error: "favorites 为空或没有有效 id" };
  }
  return { ok: true, tracks: out };
}

/**
 * Parse one line: "name", "name - artist", "name / artist", "name,artist", "name\tartist"
 */
export function parseNameArtistLine(line: string): { name: string; artist: string } | null {
  let s = String(line || "").trim();
  if (!s || s.startsWith("#") || s.startsWith("//")) return null;
  // strip CSV quotes
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).replace(/""/g, '"');

  // skip header-ish
  if (/^(歌名|歌曲|title|name|name\s*[,，\t])/i.test(s) && /作者|artist|歌手/i.test(s)) {
    return null;
  }

  let name = "";
  let artist = "";

  if (s.includes("\t")) {
    const [a, b] = s.split("\t");
    name = (a || "").trim();
    artist = (b || "").trim();
  } else if (/[,，]/.test(s) && !/^\d+[,，]/.test(s)) {
    // name,artist — avoid "1,2,3" ids
    const parts = s.split(/[,，]/);
    if (parts.length >= 2) {
      name = (parts[0] || "").trim();
      artist = parts.slice(1).join(",").trim();
    }
  } else if (/\s[-–—]\s/.test(s)) {
    const m = s.split(/\s[-–—]\s/);
    name = (m[0] || "").trim();
    artist = m.slice(1).join(" - ").trim();
  } else if (/\s\/\s/.test(s)) {
    const m = s.split(/\s\/\s/);
    name = (m[0] || "").trim();
    artist = m.slice(1).join(" / ").trim();
  } else if (/\s+by\s+/i.test(s)) {
    const m = s.split(/\s+by\s+/i);
    name = (m[0] || "").trim();
    artist = (m[1] || "").trim();
  } else {
    name = s;
    artist = "";
  }

  name = clean(name);
  artist = clean(artist);
  if (!name || name.length < 1) return null;
  // drop pure numbers / urls
  if (/^https?:\/\//i.test(name)) return null;
  return { name, artist };
}

export function parseNameListText(text: string): NameImportRow[] {
  const lines = String(text || "").split(/\r?\n/);
  const out: NameImportRow[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const p = parseNameArtistLine(line);
    if (!p) continue;
    const key = `${p.name.toLowerCase()}@@${p.artist.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const query = [p.name, p.artist].filter(Boolean).join(" ").trim();
    out.push({ kind: "name", name: p.name, artist: p.artist, query });
  }
  return out;
}

/** Detect mode and parse file content (JSON text or plain text). */
export function parseImportPayload(text: string): ParseImportResult {
  const rawText = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!rawText) return { ok: false, error: "文件为空" };

  // Try JSON first
  if (rawText.startsWith("{") || rawText.startsWith("[")) {
    let raw: unknown;
    try {
      raw = JSON.parse(rawText);
    } catch {
      return { ok: false, error: "JSON 无法解析" };
    }

    // Official export
    if (isFavsExportShape(raw)) {
      const p = parseFavsExportJson(raw);
      if (!p.ok) return p;
      return {
        ok: true,
        mode: "exact",
        rows: p.tracks.map((t) => ({ ...t, kind: "exact" as const })),
      };
    }

    // Array of objects
    if (Array.isArray(raw)) {
      const rows: ImportRow[] = [];
      const seenId = new Set<string>();
      const seenName = new Set<string>();
      let exact = 0;
      let nameOnly = 0;
      for (const item of raw) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        if (o.id != null && o.id !== "") {
          const k = String(o.id);
          if (seenId.has(k)) continue;
          seenId.add(k);
          rows.push({
            kind: "exact",
            id: /^\d+$/.test(k) ? Number(k) : (o.id as string | number),
            name: String(o.name ?? o.title ?? ""),
            artist: String(o.artist ?? o.artists ?? o.singer ?? ""),
            album: String(o.album ?? ""),
            cover: String(o.cover ?? o.picUrl ?? ""),
            duration: Number(o.duration ?? o.dt ?? 0) || 0,
          });
          exact++;
          continue;
        }
        const name = clean(String(o.name ?? o.title ?? o.song ?? ""));
        const artist = clean(String(o.artist ?? o.artists ?? o.singer ?? ""));
        if (!name) continue;
        const key = `${name.toLowerCase()}@@${artist.toLowerCase()}`;
        if (seenName.has(key)) continue;
        seenName.add(key);
        rows.push({
          kind: "name",
          name,
          artist,
          query: [name, artist].filter(Boolean).join(" ").trim(),
        });
        nameOnly++;
      }
      if (!rows.length) return { ok: false, error: "JSON 数组里没有有效条目" };
      const mode =
        exact && nameOnly ? "mixed" : exact ? "exact" : "name";
      return { ok: true, mode, rows };
    }

    return {
      ok: false,
      error: "无法识别的 JSON：支持 /favs 导出，或 [{name,artist?}] / [{id,...}]",
    };
  }

  // Plain text / CSV lines
  const nameRows = parseNameListText(rawText);
  if (!nameRows.length) {
    return {
      ok: false,
      error: "文本为空：每行「歌名」或「歌名 - 作者」/「歌名,作者」",
    };
  }
  return { ok: true, mode: "name", rows: nameRows };
}

/** Score a search hit against requested name (+ optional artist). */
export function scoreNameMatch(
  wantName: string,
  wantArtist: string,
  hitName: string,
  hitArtist: string
): number {
  const n1 = clean(wantName).toLowerCase();
  const n2 = clean(hitName).toLowerCase();
  let s = 0;
  if (!n1 || !n2) return 0;
  if (n1 === n2) s += 100;
  else if (n2.includes(n1) || n1.includes(n2)) s += 60;
  else if (n1.slice(0, 2) === n2.slice(0, 2)) s += 10;

  const a1 = clean(wantArtist).toLowerCase();
  const a2 = clean(hitArtist || "").toLowerCase();
  if (a1 && a2) {
    if (a1 === a2) s += 40;
    else if (a2.includes(a1.split(/[\/,，]/)[0]!) || a1.includes(a2.split(/[\/,，]/)[0]!))
      s += 25;
  } else if (!a1) {
    // name-only: small bonus for clean non-karaoke titles
    s += 5;
  }

  const bad = /dj|remix|live|伴奏|消音|片段|翻唱|cover|加速|剪辑|广场舞/i;
  if (bad.test(hitName || "") && !bad.test(wantName || "")) s -= 45;
  if (bad.test(hitArtist || "") && !bad.test(wantArtist || "")) s -= 25;
  return s;
}

/** Minimum score to accept a match (name-only slightly lower). */
export function minScoreForMatch(hasArtist: boolean): number {
  return hasArtist ? 80 : 95;
}

export function countNewFavorites(
  existing: { id?: string | number }[],
  incoming: { id?: string | number }[]
): number {
  const have = new Set(
    (existing || []).map((t) => String(t?.id ?? "")).filter(Boolean)
  );
  let n = 0;
  const seen = new Set<string>();
  for (const t of incoming || []) {
    const k = String(t?.id ?? "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    if (!have.has(k)) n++;
  }
  return n;
}

/** Filter to only tracks whose id is not already in existing. */
export function filterNewById<T extends { id?: string | number }>(
  existing: { id?: string | number }[],
  incoming: T[]
): T[] {
  const have = new Set(
    (existing || []).map((t) => String(t?.id ?? "")).filter(Boolean)
  );
  const out: T[] = [];
  const seen = new Set<string>();
  for (const t of incoming || []) {
    const k = String(t?.id ?? "");
    if (!k || seen.has(k) || have.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}
