import { lazy, Suspense, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { BatchSelectionBar } from '@/components/music/BatchSelectionBar';
import { MultiPlaylistSheet } from '@/components/music/MultiPlaylistSheet';
import { useDynamicThemeSync } from '@/lib/dynamicAccent';
import { triggerHaptic } from '@/lib/haptics';
import { resumeSession } from '@/party/listenTogether';
import { startPartySync } from '@/party/partySync';
import { startLivePresence } from '@/playback/livePresence';
import { useBatchSelect } from '@/state/batchSelect';
import { useUi } from '@/state/ui';
import { useUpdater } from '@/state/updater';
import { AppTopBar } from './AppTopBar';
import { OwnerCreditPopup } from './OwnerCreditPopup';
import { PlayerBar } from './PlayerBar';
import { SidePanel } from './SidePanel';
import { UnifiedSonicDock } from './UnifiedSonicDock';
import { UpdateModal } from './UpdateModal';
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
  const exitHintVisible = useUi((s) => s.exitHintVisible);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const exitTimer = useRef<number | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // Compute top-level route key so tab-to-tab transitions animate smoothly without resetting library sub-tabs unnecessarily.
  const routeKey = pathname.startsWith('/library') ? '/library' : pathname;

  useEffect(() => {
    const scroller = document.getElementById('scrollable-page');
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'auto' });
  }, [routeKey]);

  useEffect(() => {
    const w = window as unknown as {
      __audiophileHandleBack?: () => 'handled' | 'at_root';
      __audiophileShowExitHint?: () => void;
    };

    w.__audiophileHandleBack = () => {
      const updater = useUpdater.getState();
      const batch = useBatchSelect.getState();
      const ui = useUi.getState();

      // 0. Update modal (if not actively downloading)
      if (updater.modalOpen) {
        if (updater.phase !== 'downloading') updater.dismissModal();
        return 'handled';
      }
      // 1. Multi-Playlist bottom sheet
      if (batch.pickerOpen) {
        triggerHaptic('light');
        batch.closePlaylistPicker();
        return 'handled';
      }
      // 2. 3-dot TrackMenu bottom sheet
      if (ui.activeMenuClose) {
        triggerHaptic('light');
        ui.activeMenuClose();
        return 'handled';
      }
      // 3. Cinema Stage (Expand) full-screen player -> back to Lyrics / Now Playing
      if (ui.fullScreen) {
        triggerHaptic('light');
        ui.setFullScreen(false);
        return 'handled';
      }
      // 4. Now Playing / Lyrics sheet -> back to Home / active screen
      if (ui.mobileConsoleOpen) {
        triggerHaptic('light');
        ui.setMobileConsoleOpen(false);
        return 'handled';
      }
      // 5. Multi-Select batch mode
      if (batch.selecting) {
        batch.stopSelecting();
        return 'handled';
      }
      // 6. Any secondary route (Explore, Search, Library, Settings, Album, Playlist, Artist) -> back or Home
      const cur = pathnameRef.current;
      if (cur !== '/' && cur !== '/home') {
        triggerHaptic('light');
        if (window.history.length > 1) navigate(-1);
        else navigate('/home', { replace: true });
        return 'handled';
      }
      return 'at_root';
    };

    w.__audiophileShowExitHint = () => {
      triggerHaptic('light');
      useUi.getState().setExitHintVisible(true);
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
      exitTimer.current = window.setTimeout(() => {
        exitTimer.current = null;
        useUi.getState().setExitHintVisible(false);
      }, 2000);
    };

    return () => {
      delete w.__audiophileHandleBack;
      delete w.__audiophileShowExitHint;
      if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    };
  }, [navigate]);

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
        {/* Now Playing Sheet (Silky spring slide-up above AppTopBar on phone) */}
        <aside
          className={`flex w-[380px] flex-none flex-col border-r border-white/[0.08] bg-[#080c16]/90 backdrop-blur-2xl max-sm:fixed max-sm:inset-0 max-sm:z-[9940] max-sm:w-full max-sm:border-r-0 max-sm:bg-[#07090f]/98 max-sm:backdrop-blur-3xl max-sm:transition-transform max-sm:duration-[380ms] max-sm:ease-[cubic-bezier(0.22,1,0.36,1)] ${
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

        {/* Scrollable Screen Canvas with Smooth Page Transitions & Safe Bottom Clearance */}
        <main
          id="scrollable-page"
          className="no-scrollbar smooth-scroll relative min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto data-tint:bg-(--page-tint) data-tint:transition-[background-color] data-tint:duration-300 data-tint:ease-in"
        >
          <div key={routeKey} className="animate-page-enter min-h-full pb-[calc(158px+env(safe-area-inset-bottom,0px))]">
            <Outlet />
          </div>
        </main>

        <BatchSelectionBar />
        <UnifiedSonicDock />
      </div>

      <MultiPlaylistSheet />
      <UpdateModal />
      {exitHintVisible &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-0 z-[10090] grid place-items-center px-6"
          >
            <div className="animate-sheet-up rounded-full border border-white/[0.14] bg-[#0b101d]/92 px-4 py-2 text-[13px] font-medium text-white shadow-[0_14px_38px_rgba(0,0,0,0.72)] backdrop-blur-2xl">
              Press back again to exit
            </div>
          </div>,
          document.body,
        )}
      {fullScreen && (
        <Suspense fallback={null}>
          <FullScreenPlayer />
        </Suspense>
      )}
      <OwnerCreditPopup />
    </div>
  );
}
