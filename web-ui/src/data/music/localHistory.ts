import { useSyncExternalStore } from 'react';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import type { Track } from './types';

const STORAGE_KEY = 'audiophile:recent_tracks';
const MAX_LOCAL_RECENT = 50;

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedList: Track[] = [];

function notifyListeners(): void {
  cachedRaw = undefined;
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Reads music tracks recently played inside Audiophile (newest first). */
export function loadLocalRecentTracks(): Track[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === cachedRaw) return cachedList;
    cachedRaw = raw;
    if (!raw) {
      cachedList = [];
      return cachedList;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedList = [];
      return cachedList;
    }
    cachedList = parsed
      .filter(
        (item): item is Track =>
          !!item && typeof item === 'object' && typeof item.videoId === 'string' && typeof item.title === 'string',
      )
      .map((t) => ({
        ...t,
        title: cleanTrackTitle(t.title, t.artists?.[0]?.name),
      }));
    return cachedList;
  } catch {
    cachedList = [];
    return cachedList;
  }
}

/** Reactive hook returning locally played tracks (newest first). */
export function useLocalRecentTracks(): Track[] {
  return useSyncExternalStore(subscribe, loadLocalRecentTracks, () => []);
}

/** Prepends [track] to local recently played music history, deduplicated by videoId. */
export function recordLocalRecentTrack(track: Track): void {
  if (!track?.videoId || !track.title) return;
  try {
    const existing = loadLocalRecentTracks().filter((t) => t.videoId !== track.videoId);
    const next = [{ ...track, index: 1 }, ...existing].slice(0, MAX_LOCAL_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notifyListeners();
  } catch {
    // Ignore storage quota errors.
  }
}

/** Merges [primary] then [secondary], keeping unique videoIds in order. */
export function mergeRecentTracks(primary: Track[], secondary: Track[], limit = MAX_LOCAL_RECENT): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const list of [primary, secondary]) {
    for (const track of list) {
      if (!track.videoId || seen.has(track.videoId)) continue;
      seen.add(track.videoId);
      out.push({ ...track, index: out.length + 1 });
      if (out.length >= limit) return out;
    }
  }
  return out;
}
