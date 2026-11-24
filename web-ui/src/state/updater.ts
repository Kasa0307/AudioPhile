import { create } from 'zustand';
import { triggerHaptic } from '@/lib/haptics';
import { useBatchSelect } from './batchSelect';

/** Public GitHub raw manifest for Kasa0307/AudioPhile OTA updates. */
export const UPDATE_MANIFEST_URL =
  'https://raw.githubusercontent.com/Kasa0307/AudioPhile/main/update.json';

export interface UpdateManifest {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  releaseDate?: string;
  changelogs: string[];
}

export type UpdatePhase = 'idle' | 'checking' | 'permission_needed' | 'downloading' | 'installing' | 'error';

interface NativeUpdaterBridge {
  getAppVersionCode?: () => number;
  getAppVersionName?: () => string;
  canInstallPackages?: () => boolean;
  openInstallPermissionSettings?: () => void;
  fetchUpdateManifest?: (manifestUrl: string) => void;
  downloadAndInstallUpdate?: (apkUrl: string) => void;
}

function getNative(): NativeUpdaterBridge | null {
  return (window as unknown as { AudiophileNative?: NativeUpdaterBridge }).AudiophileNative ?? null;
}

export function getInstalledVersion(): { code: number; name: string } {
  try {
    const bridge = getNative();
    const code = bridge?.getAppVersionCode ? Number(bridge.getAppVersionCode()) : 3;
    const name = bridge?.getAppVersionName ? String(bridge.getAppVersionName()) : '2.1.0';
    return { code: Number.isFinite(code) && code > 0 ? code : 3, name: name || '2.1.0' };
  } catch {
    return { code: 3, name: '2.1.0' };
  }
}

interface UpdaterState {
  currentCode: number;
  currentName: string;
  available: UpdateManifest | null;
  modalOpen: boolean;
  phase: UpdatePhase;
  progress: number;
  detail: string;
  error: string | null;

  checkForUpdates: (manual?: boolean) => Promise<void>;
  startInstall: () => void;
  openPermissionSettings: () => void;
  dismissModal: () => void;
}

let pendingManifestResolve: ((val: { json: string | null; error: string | null }) => void) | null = null;
let bridgeWired = false;

function ensureWindowCallbacks(): void {
  if (bridgeWired || typeof window === 'undefined') return;
  bridgeWired = true;
  const w = window as unknown as {
    __audiophileUpdateManifest?: (rawJson: string | null, error: string | null) => void;
    __audiophileUpdateProgress?: (percent: number, status: string, message: string) => void;
  };

  w.__audiophileUpdateManifest = (rawJson, error) => {
    const resolve = pendingManifestResolve;
    pendingManifestResolve = null;
    resolve?.({ json: rawJson, error });
  };

  w.__audiophileUpdateProgress = (percent, status, message) => {
    const nextPhase: UpdatePhase =
      status === 'permission_needed'
        ? 'permission_needed'
        : status === 'downloading'
          ? 'downloading'
          : status === 'installing'
            ? 'installing'
            : status === 'error'
              ? 'error'
              : 'idle';

    useUpdater.setState({
      phase: nextPhase,
      progress: Math.max(0, Math.min(100, Number(percent) || 0)),
      detail: message || '',
      error: nextPhase === 'error' ? message || 'Download failed' : null,
    });
  };
}

async function fetchManifestRaw(url: string): Promise<string> {
  ensureWindowCallbacks();
  const bridge = getNative();
  if (bridge?.fetchUpdateManifest) {
    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        pendingManifestResolve = null;
        reject(new Error('Update check timed out'));
      }, 15_000);

      pendingManifestResolve = ({ json, error }) => {
        clearTimeout(timeout);
        if (error || !json) reject(new Error(error || 'Unable to load update info'));
        else resolve(json);
      };

      bridge.fetchUpdateManifest!(url);
    });
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseManifest(raw: string): UpdateManifest | null {
  try {
    const cleaned = raw.replace(/^\uFEFF/, '').trim();
    const data = JSON.parse(cleaned) as Partial<UpdateManifest>;
    if (
      typeof data.versionCode !== 'number' ||
      typeof data.versionName !== 'string' ||
      typeof data.apkUrl !== 'string' ||
      !data.apkUrl.startsWith('https://')
    ) {
      return null;
    }
    const changelogs = Array.isArray(data.changelogs)
      ? data.changelogs.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
      : [];
    return {
      versionCode: data.versionCode,
      versionName: data.versionName,
      apkUrl: data.apkUrl,
      releaseDate: typeof data.releaseDate === 'string' ? data.releaseDate : undefined,
      changelogs,
    };
  } catch {
    return null;
  }
}

const installed = getInstalledVersion();

export const useUpdater = create<UpdaterState>()((set, get) => ({
  currentCode: installed.code,
  currentName: installed.name,
  available: null,
  modalOpen: false,
  phase: 'idle',
  progress: 0,
  detail: '',
  error: null,

  async checkForUpdates(manual = false) {
    const fresh = getInstalledVersion();
    if (get().phase === 'downloading' || get().phase === 'checking') return;
    set({ currentCode: fresh.code, currentName: fresh.name, phase: 'checking', error: null });

    try {
      const raw = await fetchManifestRaw(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`);
      const manifest = parseManifest(raw);
      if (!manifest) {
        throw new Error('Invalid update manifest');
      }

      if (manifest.versionCode > fresh.code) {
        triggerHaptic('medium');
        set({
          available: manifest,
          modalOpen: true,
          phase: 'idle',
          progress: 0,
          detail: '',
          error: null,
        });
      } else {
        set({ available: null, phase: 'idle', error: null });
        if (manual) {
          useBatchSelect.getState().showToast(`Audiophile v${fresh.name} is up to date`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to check for updates';
      set({ phase: 'idle', error: manual ? msg : null });
      if (manual) {
        useBatchSelect.getState().showToast('Could not check for updates');
      }
    }
  },

  startInstall() {
    const manifest = get().available;
    if (!manifest) return;
    ensureWindowCallbacks();
    triggerHaptic('medium');

    const bridge = getNative();
    if (!bridge?.downloadAndInstallUpdate) {
      window.open(manifest.apkUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    set({ error: null });
    bridge.downloadAndInstallUpdate(manifest.apkUrl);
  },

  openPermissionSettings() {
    triggerHaptic('light');
    getNative()?.openInstallPermissionSettings?.();
  },

  dismissModal() {
    if (get().phase === 'downloading') return;
    triggerHaptic('light');
    set({ modalOpen: false, phase: 'idle', error: null });
  },
}));
