import { create } from 'zustand';
import type { Track } from '@/data/music/types';
import { triggerHaptic } from '@/lib/haptics';

let toastTimer: number | null = null;

interface BatchSelectState {
  /** Whether Multi-Select Mode is active on Home & Search for batch playlist adding. */
  selecting: boolean;
  /** Tracks picked across Home / Search while in Multi-Select Mode. */
  selectedTracks: Track[];
  /** Whether the slide-up Multi-Playlist Picker Bottom Sheet is open. */
  pickerOpen: boolean;
  /** Tracks currently being added inside the Multi-Playlist Picker sheet. */
  pickerTracks: Track[];
  /** Transient confirmation toast message. */
  toast: string | null;

  startSelecting: (initialTrack?: Track) => void;
  stopSelecting: () => void;
  toggleTrack: (track: Track) => void;
  clearSelected: () => void;
  openPlaylistPicker: (tracks: Track[]) => void;
  closePlaylistPicker: () => void;
  showToast: (message: string) => void;
}

export const useBatchSelect = create<BatchSelectState>()((set) => ({
  selecting: false,
  selectedTracks: [],
  pickerOpen: false,
  pickerTracks: [],
  toast: null,

  startSelecting: (initialTrack) => {
    triggerHaptic('medium');
    set((s) => {
      if (!initialTrack) return { selecting: true };
      const exists = s.selectedTracks.some((t) => t.videoId === initialTrack.videoId);
      return {
        selecting: true,
        selectedTracks: exists ? s.selectedTracks : [...s.selectedTracks, initialTrack],
      };
    });
  },

  stopSelecting: () => {
    triggerHaptic('light');
    set({ selecting: false, selectedTracks: [] });
  },

  toggleTrack: (track) => {
    triggerHaptic('light');
    set((s) => {
      const exists = s.selectedTracks.some((t) => t.videoId === track.videoId);
      return {
        selectedTracks: exists
          ? s.selectedTracks.filter((t) => t.videoId !== track.videoId)
          : [...s.selectedTracks, track],
      };
    });
  },

  clearSelected: () => {
    triggerHaptic('light');
    set({ selectedTracks: [] });
  },

  openPlaylistPicker: (tracks) => {
    if (!tracks.length) return;
    triggerHaptic('light');
    set({ pickerOpen: true, pickerTracks: tracks });
  },

  closePlaylistPicker: () => set({ pickerOpen: false, pickerTracks: [] }),

  showToast: (message) => {
    if (toastTimer !== null) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = window.setTimeout(() => {
      toastTimer = null;
      set({ toast: null });
    }, 2600);
  },
}));
