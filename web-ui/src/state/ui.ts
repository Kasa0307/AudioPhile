import { create } from 'zustand';

export type SidePanel = 'up-next' | 'lyrics' | null;

const AMBIENT_KEY = 'audiophile:dynamic-ambient';
const HAPTICS_KEY = 'audiophile:haptics-enabled';
const BANNER_KEY = 'bitchord:install-banner-dismissed';

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    // Ignore storage read errors.
  }
  return fallback;
}

interface UiState {
  /** The persistent Studio Deck lower tab: Live Lyrics or Up Next Queue. */
  sidePanel: SidePanel;
  toggleSidePanel: (panel: Exclude<SidePanel, null>) => void;
  closeSidePanel: () => void;
  /** Whether the full-height Studio Console sheet is open on phone (< 640px). */
  mobileConsoleOpen: boolean;
  setMobileConsoleOpen: (open: boolean) => void;
  /** The full-screen player: artwork, controls and lyrics over the artwork's mesh (report §7). */
  fullScreen: boolean;
  setFullScreen: (open: boolean) => void;
  /** Dynamic album-extracted radial ambient glow & accent tint across the app. */
  dynamicAmbient: boolean;
  setDynamicAmbient: (enabled: boolean) => void;
  /** Tactile haptic feedback on Android & mobile controls. */
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => void;
  /** Extension install banner state (kept for compatibility). */
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  installBannerDismissed: boolean;
  dismissInstallBanner: () => void;
}

export const useUi = create<UiState>()((set) => ({
  sidePanel: 'lyrics',
  toggleSidePanel: (panel) => set((s) => ({ sidePanel: s.sidePanel === panel ? null : panel })),
  closeSidePanel: () => set({ sidePanel: null }),
  mobileConsoleOpen: false,
  setMobileConsoleOpen: (mobileConsoleOpen) => set({ mobileConsoleOpen }),
  fullScreen: false,
  setFullScreen: (fullScreen) => set({ fullScreen }),
  dynamicAmbient: readBool(AMBIENT_KEY, true),
  setDynamicAmbient: (dynamicAmbient) => {
    try {
      localStorage.setItem(AMBIENT_KEY, dynamicAmbient ? '1' : '0');
    } catch {
      // Ignore storage quota errors.
    }
    set({ dynamicAmbient });
  },
  hapticsEnabled: readBool(HAPTICS_KEY, true),
  setHapticsEnabled: (hapticsEnabled) => {
    try {
      localStorage.setItem(HAPTICS_KEY, hapticsEnabled ? '1' : '0');
    } catch {
      // Ignore storage quota errors.
    }
    set({ hapticsEnabled });
  },
  drawerOpen: false,
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
  installBannerDismissed: sessionStorage.getItem(BANNER_KEY) === '1',
  dismissInstallBanner: () => {
    sessionStorage.setItem(BANNER_KEY, '1');
    set({ installBannerDismissed: true });
  },
}));

// For browser-driven tests, next to __bcPlayer.
if (import.meta.env.DEV) Object.assign(window, { __bcUi: useUi });
