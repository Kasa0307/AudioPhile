import { lazy, Suspense, useEffect } from 'react';
import { Outlet } from 'react-router';
import { useDynamicThemeSync } from '@/lib/dynamicAccent';
import { resumeSession } from '@/party/listenTogether';
import { startPartySync } from '@/party/partySync';
import { startLivePresence } from '@/playback/livePresence';
import { useUi } from '@/state/ui';
import { AppTopBar } from './AppTopBar';
import { OwnerCreditPopup } from './OwnerCreditPopup';
import { PlayerBar } from './PlayerBar';
import { SidePanel } from './SidePanel';
import { UnifiedSonicDock } from './UnifiedSonicDock';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

// It carries am-lyrics; loaded the first time it opens, as the side panel's lyrics are.
const FullScreenPlayer = lazy(() => import('./FullScreenPlayer').then((m) => ({ default: m.FullScreenPlayer })));

/**
 * Tactile Digital Hi-Fi Mobile App Shell:
 * - Obsidian base (#07090F) + Dynamic Artwork Ambient Radial Mesh Glow + 2.5% analog grain texture
 * - Contextual Minimal Top Bar (AppTopBar)
 * - Full-bleed scrollable canvas with generous Unified Sonic Dock bottom clearance
 * - Slide-up Now Playing Console Sheet (PlayerBar + Acoustic Glass Lyrics/Up Next)
 * - Unified Floating Sonic Dock (Mini-Player + 4 core tabs)
 */
export function AppShell() {
  useKeyboardShortcuts();
  useDynamicThemeSync();

  useEffect(() => {
    resumeSession();
    return startPartySync();
  }, []);
  useEffect(() => startLivePresence(), []);

  const fullScreen = useUi((s) => s.fullScreen);
  const mobileConsoleOpen = useUi((s) => s.mobileConsoleOpen);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#07090f]">
      {/* Dynamic Artwork Ambient Radial Mesh Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[58vh] transition-[background,opacity] duration-700 ease-out"
        style={{
          background:
            'radial-gradient(ellipse 92% 72% at 24% -6%, rgba(var(--ambient-rgb), var(--ambient-opacity)) 0%, rgba(var(--accent-rgb), calc(var(--ambient-opacity) * 0.42)) 42%, transparent 78%)',
        }}
      />
      {/* Subtle 2% Analog Grain Texture Overlay */}
      <div aria-hidden="true" className="acoustic-grain pointer-events-none fixed inset-0 z-0" />

      <AppTopBar />

      <div className="relative flex min-h-0 flex-1 flex-row overflow-hidden">
        {/* Now Playing Sheet (Slide-up above AppTopBar on phone, side deck on wide tablet) */}
        <aside
          className={`flex w-[380px] flex-none flex-col border-r border-white/[0.08] bg-[#080c16]/90 backdrop-blur-2xl max-sm:fixed max-sm:inset-0 max-sm:z-[9940] max-sm:w-full max-sm:border-r-0 max-sm:bg-[#07090f]/98 max-sm:backdrop-blur-3xl max-sm:transition-transform max-sm:duration-300 max-sm:ease-out ${
            mobileConsoleOpen ? 'max-sm:translate-y-0' : 'max-sm:pointer-events-none max-sm:translate-y-full'
          }`}
          style={{
            backgroundImage:
              'radial-gradient(ellipse 90% 45% at 50% 0%, rgba(var(--ambient-rgb), calc(var(--ambient-opacity) * 1.1)) 0%, transparent 70%)',
          }}
        >
          <PlayerBar />
          <SidePanel />
        </aside>

        {/* Scrollable Screen Canvas with Safe Bottom Clearance (Sonic Dock height + 28px) */}
        <main
          id="scrollable-page"
          className="no-scrollbar relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto data-tint:bg-(--page-tint) data-tint:transition-[background-color] data-tint:duration-300 data-tint:ease-in"
        >
          <div className="min-h-full pb-[calc(158px+env(safe-area-inset-bottom,0px))]">
            <Outlet />
          </div>
        </main>

        <UnifiedSonicDock />
      </div>

      {fullScreen && (
        <Suspense fallback={null}>
          <FullScreenPlayer />
        </Suspense>
      )}
      <OwnerCreditPopup />
    </div>
  );
}
