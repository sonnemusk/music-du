/**
 * Favorite / next-track audio blob cache (IndexedDB).
 *
 * Why same-origin stream only for durable store:
 * - CDN signed URLs often lack CORS → fetch() fails
 * - /api/stream/:id is same-origin and Range-capable
 *
 * Limits keep phone storage sane (LRU by last access).
 */

const DB_NAME = "kazam-audio-v1";
const DB_VERSION = 1;
const STORE = "blobs";
const MAX_ENTRIES = 36;
/** Soft cap ~220 MB — drop oldest until under. */
const MAX_BYTES = 220 * 1024 * 1024;

export type AudioCacheMeta = {
  id: string;
  mime: string;
  size: number;
  level: string;
  ts: number;
  /** last access for LRU */
  at: number;
};

type AudioRow = AudioCacheMeta & { blob: Blob };

let dbPromise: Promise<IDBDatabase> | null = null;
const objectUrls = new Map<string, string>();
/** In-flight fetches so we don't double-download the same id. */
const inflight = new Map<string, Promise<boolean>>();

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("no indexedDB"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("idb open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
  return dbPromise;
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("aborted"));
  });
}

export async function hasAudioBlob(id: string | number): Promise<boolean> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readonly");
    const row = await idbReq<AudioRow | undefined>(
      tx.objectStore(STORE).get(String(id))
    );
    return Boolean(row?.blob);
  } catch {
    return false;
  }
}

export async function getAudioBlob(
  id: string | number
): Promise<{ blob: Blob; mime: string; level: string } | null> {
  try {
    const db = await openDb();
    const key = String(id);
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const row = await idbReq<AudioRow | undefined>(store.get(key));
    if (!row?.blob) return null;
    row.at = Date.now();
    store.put(row);
    await idbTxDone(tx);
    return { blob: row.blob, mime: row.mime || row.blob.type || "audio/mpeg", level: row.level || "" };
  } catch {
    return null;
  }
}

/** Returns a blob: URL (revokes previous for same id). Caller should not revoke while playing. */
export async function getAudioObjectURL(id: string | number): Promise<string | null> {
  const hit = await getAudioBlob(id);
  if (!hit) return null;
  const key = String(id);
  const prev = objectUrls.get(key);
  if (prev) {
    try {
      URL.revokeObjectURL(prev);
    } catch {
      /* */
    }
  }
  const url = URL.createObjectURL(hit.blob);
  objectUrls.set(key, url);
  return url;
}

export function revokeAudioObjectURL(id: string | number) {
  const key = String(id);
  const u = objectUrls.get(key);
  if (!u) return;
  try {
    URL.revokeObjectURL(u);
  } catch {
    /* */
  }
  objectUrls.delete(key);
}

export async function putAudioBlob(
  id: string | number,
  blob: Blob,
  opts?: { level?: string; mime?: string }
): Promise<void> {
  if (!blob || blob.size < 1024) return; // ignore tiny/error bodies
  try {
    const db = await openDb();
    const key = String(id);
    const now = Date.now();
    const row: AudioRow = {
      id: key,
      blob,
      mime: opts?.mime || blob.type || "audio/mpeg",
      size: blob.size,
      level: opts?.level || "",
      ts: now,
      at: now,
    };
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    await idbTxDone(tx);
    await enforceQuota();
  } catch {
    /* quota / private */
  }
}

async function listAllMeta(): Promise<AudioCacheMeta[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const all = await idbReq<AudioRow[]>(tx.objectStore(STORE).getAll());
  return (all || []).map((r) => ({
    id: r.id,
    mime: r.mime,
    size: r.size || r.blob?.size || 0,
    level: r.level || "",
    ts: r.ts || 0,
    at: r.at || r.ts || 0,
  }));
}

async function enforceQuota() {
  try {
    let metas = await listAllMeta();
    let total = metas.reduce((s, m) => s + (m.size || 0), 0);
    if (metas.length <= MAX_ENTRIES && total <= MAX_BYTES) return;

    metas = metas.sort((a, b) => (a.at || 0) - (b.at || 0)); // oldest access first
    const db = await openDb();
    while (metas.length && (metas.length > MAX_ENTRIES || total > MAX_BYTES)) {
      const drop = metas.shift()!;
      total -= drop.size || 0;
      revokeAudioObjectURL(drop.id);
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(drop.id);
      await idbTxDone(tx);
    }
  } catch {
    /* */
  }
}

export async function deleteAudioBlob(id: string | number): Promise<void> {
  revokeAudioObjectURL(id);
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(String(id));
    await idbTxDone(tx);
  } catch {
    /* */
  }
}

/**
 * CF Workers `/api/stream` only 302s to CDN (no byte proxy, free tier).
 * CDN usually lacks CORS → IDB blob cache never fills. Detect once via /api/health.
 */
let durableBlobAllowed: boolean | null = null;

export async function canDurableAudioCache(): Promise<boolean> {
  if (durableBlobAllowed != null) return durableBlobAllowed;
  try {
    const r = await fetch("/api/health", { credentials: "same-origin" });
    const j = (await r.json()) as {
      runtime?: string;
      policy?: { audio_byte_proxy?: boolean };
    };
    if (j?.policy?.audio_byte_proxy === false) {
      durableBlobAllowed = false;
      return false;
    }
    if (j?.runtime === "cloudflare-workers") {
      durableBlobAllowed = false;
      return false;
    }
  } catch {
    /* fall through — allow try on Node/local */
  }
  durableBlobAllowed = true;
  return true;
}

/** Test helper */
export function resetDurableAudioCacheGate() {
  durableBlobAllowed = null;
}

/**
 * Download audio via same-origin stream proxy and store in IDB.
 * No-ops on CF Workers (302-only stream). Uses AbortSignal for cancel.
 */
export async function cacheAudioFromStream(
  id: string | number,
  opts?: { level?: string; signal?: AbortSignal; force?: boolean }
): Promise<boolean> {
  if (!(await canDurableAudioCache())) return false;
  const key = String(id);
  if (!opts?.force && (await hasAudioBlob(key))) return true;
  const existing = inflight.get(key);
  if (existing) return existing;

  const work = (async () => {
    try {
      // Include preferred level so stream redirect matches playback quality
      const lv = opts?.level ? `?level=${encodeURIComponent(opts.level)}` : "";
      const streamUrl = `/api/stream/${encodeURIComponent(key)}${lv}`;
      // Manual redirect: if 302, body is empty (CF) — don't follow to CORS-blocked CDN
      const res = await fetch(streamUrl, {
        credentials: "same-origin",
        signal: opts?.signal,
        headers: { Accept: "audio/*,*/*" },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        durableBlobAllowed = false;
        return false;
      }
      if (!res.ok) return false;
      const blob = await res.blob();
      if (blob.size < 8 * 1024) return false;
      await putAudioBlob(key, blob, {
        level: opts?.level,
        mime: res.headers.get("Content-Type") || blob.type || "audio/mpeg",
      });
      return true;
    } catch {
      return false;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, work);
  return work;
}

/**
 * Warm browser media buffer for a URL without storing a blob.
 * Low priority vs current playback — max 1 warmer so next-track never crowds current.
 */
const warmers = new Map<string, HTMLAudioElement>();

/** Background blob downloads for neighbors (not the track currently playing). */
let neighborBlobAbort: AbortController | null = null;

export function abortNeighborBlobCaches(): void {
  try {
    neighborBlobAbort?.abort();
  } catch {
    /* */
  }
  neighborBlobAbort = new AbortController();
}

export function neighborBlobSignal(): AbortSignal | undefined {
  if (!neighborBlobAbort) neighborBlobAbort = new AbortController();
  return neighborBlobAbort.signal;
}

export function warmMediaUrl(id: string | number, url: string): void {
  if (!url || typeof Audio === "undefined") return;
  const key = String(id);
  if (warmers.has(key)) return;
  try {
    // Only keep the newest warmer (predicted next). Drop others so current stream wins.
    for (const k of [...warmers.keys()]) {
      if (k !== key) disposeWarmer(k);
    }
    const a = new Audio();
    a.preload = "auto";
    a.muted = true;
    a.src = url;
    void a.load();
    warmers.set(key, a);
  } catch {
    /* */
  }
}

export function disposeWarmer(id: string | number) {
  const key = String(id);
  const a = warmers.get(key);
  if (!a) return;
  try {
    a.removeAttribute("src");
    a.load();
  } catch {
    /* */
  }
  warmers.delete(key);
}

export function disposeAllWarmers() {
  for (const k of [...warmers.keys()]) disposeWarmer(k);
}
