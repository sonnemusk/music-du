/**
 * Debounced library persist, extracted from the main player store so
 * play/search/chart updates do not keep growing player.ts.
 */
import * as api from "../lib/api";
import {
  resolveStructuralLibraryConflict,
  trackIdSetEqual,
} from "../lib/library-union";
import type { Library, Track } from "../lib/types";
import { t as i18n } from "../i18n";

export const LIBRARY_LS_KEY = "kazam.v2.library";

export const SAVE_FAST_MS = 500;
export const SAVE_SLOW_MS = 20_000;

export type LibraryPersistSlice = {
  playlist: Track[];
  favorites: Track[];
  history: Track[];
  curIdx: number;
  libraryRevision: number;
  libraryReadOnly: boolean;
  showToast: (msg: string) => void;
};

type PersistGet = () => LibraryPersistSlice;
type PersistSet = (p: Partial<LibraryPersistSlice>) => void;

let persistSet: PersistSet = () => {};

export function bindLibraryPersistSet(set: PersistSet) {
  persistSet = set;
}

function normTrack(t: Track | null | undefined): Track | null {
  if (!t || t.id == null) return null;
  return {
    id: t.id,
    name: t.name || "",
    artist: t.artist || "",
    album: t.album || "",
    cover: t.cover || "",
    duration: t.duration || 0,
    level: t.level || "",
    br: t.br || 0,
    size: t.size || 0,
    rank: t.rank,
  };
}

export function applyLib(set: PersistSet) {
  return (lib: Library) => {
    set({
      playlist: (lib.playlist || []).map(normTrack).filter(Boolean) as Track[],
      favorites: (lib.favorites || []).map(normTrack).filter(Boolean) as Track[],
      history: (lib.history || []).map(normTrack).filter(Boolean) as Track[],
      curIdx: lib.curIdx ?? -1,
      libraryRevision: Number(lib.revision ?? 0) || 0,
    });
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saveInflight = false;
let saveDirty = false;
let saveForce: Record<string, boolean> = {};
let saveFlushBound = false;
/** A pending fast save must not be pushed back by later history churn. */
let savePendingFast = false;

function mirrorLibraryLocal(get: PersistGet) {
  if (get().libraryReadOnly) return;
  try {
    const s = get();
    localStorage.setItem(
      LIBRARY_LS_KEY,
      JSON.stringify({
        playlist: s.playlist,
        favorites: s.favorites,
        history: s.history,
        curIdx: s.curIdx,
        revision: s.libraryRevision,
      })
    );
  } catch {
    /* */
  }
}

/**
 * Two-speed save.
 * fast (500ms)  — deliberate library edits (fav / queue / import / clears)
 * slow (20s)    — playback churn only (history, curIdx); flushed on hide/unload
 */
export function persistSoon(
  get: PersistGet,
  force: Record<string, boolean> = {},
  opts: { fast?: boolean } = {}
) {
  if (get().libraryReadOnly) return;
  mirrorLibraryLocal(get);
  saveDirty = true;
  saveForce = { ...saveForce, ...force };
  const fast = opts.fast === true || Object.keys(force).length > 0 || savePendingFast;
  savePendingFast = fast;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(
    () => {
      void flushLibrarySave(get);
    },
    fast ? SAVE_FAST_MS : SAVE_SLOW_MS
  );
  if (!saveFlushBound && typeof window !== "undefined") {
    saveFlushBound = true;
    const flush = () => {
      if (saveTimer) clearTimeout(saveTimer);
      void flushLibrarySave(get);
    };
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
  }
}

export async function flushLibrarySave(get: PersistGet) {
  if (get().libraryReadOnly) {
    saveDirty = false;
    return;
  }
  if (saveInflight) return;
  if (!saveDirty) return;
  saveInflight = true;
  saveDirty = false;
  savePendingFast = false;
  const force = { ...saveForce };
  saveForce = {};
  const s = get();
  const payload = {
    playlist: s.playlist,
    favorites: s.favorites,
    history: s.history,
    curIdx: s.curIdx,
    revision: s.libraryRevision,
    ...force,
  };
  mirrorLibraryLocal(get);
  try {
    const lib = await api.saveLibrary(payload);
    const rev = Number(lib.revision ?? 0) || 0;
    if (saveDirty) {
      persistSet({ libraryRevision: rev });
    } else {
      applyLib(persistSet)(lib);
    }
  } catch (e) {
    if (e instanceof api.LibraryConflictError) {
      const server = e.data;
      const rev = Number(server.revision ?? 0) || 0;
      const sameFavPl =
        trackIdSetEqual(payload.favorites, server.favorites) &&
        trackIdSetEqual(payload.playlist, server.playlist);
      if (sameFavPl) {
        persistSet({ libraryRevision: rev });
        saveDirty = true;
      } else {
        const { next, historyDiverged } = resolveStructuralLibraryConflict(payload, server);
        applyLib(persistSet)(next);
        if (historyDiverged) {
          saveDirty = true;
          get().showToast(i18n("toast.libSynced"));
        }
      }
    }
  } finally {
    saveInflight = false;
    if (saveDirty) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void flushLibrarySave(get);
      }, 100);
    }
  }
}
