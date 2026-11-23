import { useUi } from '@/state/ui';

export type HapticStyle = 'light' | 'medium' | 'heavy';

interface AudiophileNativeBridge {
  haptic?: (style: string) => void;
}

/**
 * Fires native Android haptic feedback via MainActivity's AudiophileNative JS bridge,
 * with a gentle navigator.vibrate fallback when running outside the APK.
 */
export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (!useUi.getState().hapticsEnabled) return;
  try {
    const bridge = (window as unknown as { AudiophileNative?: AudiophileNativeBridge }).AudiophileNative;
    if (bridge?.haptic) {
      bridge.haptic(style);
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(style === 'heavy' ? 16 : style === 'medium' ? 10 : 5);
    }
  } catch {
    // Ignore haptic failures on unsupported devices.
  }
}
