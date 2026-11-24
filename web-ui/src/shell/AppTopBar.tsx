import { ListChecks, Settings, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { PrefetchLink, PrefetchNavLink } from '@/components/PrefetchLink';
import { useSignedIn } from '@/data/music/queries';
import { triggerHaptic } from '@/lib/haptics';
import { useBatchSelect } from '@/state/batchSelect';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';

function titleForPath(pathname: string): string {
  if (pathname.startsWith('/new')) return 'Explore';
  if (pathname.startsWith('/search')) return 'Search';
  if (pathname.startsWith('/library')) return 'Library';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/album')) return 'Album';
  if (pathname.startsWith('/playlist')) return 'Playlist';
  if (pathname.startsWith('/artist')) return 'Artist';
  return 'Audiophile';
}

/**
 * Minimal Contextual Top Bar:
 * - Clean single-line title ("Audiophile" on Home, or active screen name)
 * - Minimal circular frosted-glass Settings button on the right
 * - Smooth gradient fade along the bottom edge so scrolled content dissolves cleanly behind it
 */
export function AppTopBar() {
  const { pathname } = useLocation();
  const signedIn = useSignedIn();
  const status = usePlayer((s) => s.status);
  const setMobileConsoleOpen = useUi((s) => s.setMobileConsoleOpen);
  const selecting = useBatchSelect((s) => s.selecting);
  const { startSelecting, stopSelecting } = useBatchSelect.getState();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = document.getElementById('scrollable-page');
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 12);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pathname]);

  const screenTitle = titleForPath(pathname);
  const isPlaying = status === 'playing' || status === 'buffering';
  const onSettings = pathname.startsWith('/settings');

  return (
    <header
      aria-label="Main"
      className={`relative z-(--z-web-chrome) flex flex-none items-center justify-between gap-3 px-4 pb-2.5 transition-colors duration-300 ${
        scrolled ? 'bg-[#07090f]/82 backdrop-blur-2xl' : 'bg-[#07090f]/35 backdrop-blur-md'
      }`}
      style={{
        paddingTop: 'max(10px, var(--android-safe-top, 0px), env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Left: Minimal Brand / Dynamic Screen Title */}
      <PrefetchLink
        to="/home"
        onClick={() => {
          triggerHaptic('light');
          setMobileConsoleOpen(false);
        }}
        className="flex min-w-0 items-center gap-2.5"
        aria-label="Audiophile, Home"
      >
        <span
          className="grid size-7 flex-none place-items-center rounded-[9px] border border-white/[0.11] bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
          style={{
            boxShadow: isPlaying ? '0 0 14px rgba(var(--accent-rgb), 0.35)' : undefined,
          }}
        >
          <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
            <span
              className={`w-[2px] rounded-full ${isPlaying ? 'animate-sonic-eq' : ''}`}
              style={{ backgroundColor: 'var(--accent-bright)', height: isPlaying ? '100%' : '45%', animationDelay: '0ms' }}
            />
            <span
              className={`w-[2px] rounded-full ${isPlaying ? 'animate-sonic-eq' : ''}`}
              style={{ backgroundColor: 'var(--accent-hex)', height: isPlaying ? '100%' : '80%', animationDelay: '180ms' }}
            />
            <span
              className={`w-[2px] rounded-full ${isPlaying ? 'animate-sonic-eq' : ''}`}
              style={{ backgroundColor: 'var(--accent-bright)', height: isPlaying ? '100%' : '55%', animationDelay: '340ms' }}
            />
          </span>
        </span>
        <span className="truncate text-[18px] font-bold leading-tight tracking-[-0.02em] text-primary">
          {screenTitle}
        </span>
      </PrefetchLink>

      {/* Right: Optional Multi-Select trigger (Home/Search when signed in) + Minimal Settings Button */}
      <div className="flex flex-none items-center gap-2">
        {signedIn && (pathname === '/' || pathname.startsWith('/home') || pathname.startsWith('/search') || selecting) && (
          <button
            type="button"
            onClick={() => (selecting ? stopSelecting() : startSelecting())}
            aria-label={selecting ? 'Cancel multi-select' : 'Select multiple songs for playlists'}
            aria-pressed={selecting}
            className="grid size-9 flex-none place-items-center rounded-full border border-white/[0.11] bg-[#101626]/72 text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_18px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-150 hover:text-primary active:scale-92"
            style={
              selecting
                ? {
                    borderColor: 'rgba(var(--accent-rgb), 0.65)',
                    backgroundColor: 'rgba(var(--accent-rgb), 0.24)',
                    color: 'var(--accent-bright)',
                    boxShadow: '0 0 16px rgba(var(--accent-rgb), 0.35)',
                  }
                : undefined
            }
          >
            {selecting ? <X size={16} strokeWidth={2.2} /> : <ListChecks size={16} strokeWidth={2} />}
          </button>
        )}

        <PrefetchNavLink
          to="/settings"
          onClick={() => {
            triggerHaptic('light');
            setMobileConsoleOpen(false);
          }}
          aria-label="Settings"
          className="grid size-9 flex-none place-items-center rounded-full border border-white/[0.11] bg-[#101626]/72 text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_18px_rgba(0,0,0,0.32)] backdrop-blur-xl transition-all duration-150 hover:text-primary active:scale-92"
          style={
            onSettings
              ? {
                  borderColor: 'rgba(var(--accent-rgb), 0.55)',
                  backgroundColor: 'rgba(var(--accent-rgb), 0.2)',
                  color: 'var(--accent-bright)',
                }
              : undefined
          }
        >
          <Settings size={16} strokeWidth={2} />
        </PrefetchNavLink>
      </div>

      {/* Smooth downward gradient fade so scrolled content dissolves softly behind the Top Bar */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-full h-6 transition-opacity duration-300"
        style={{
          opacity: scrolled ? 1 : 0.45,
          background: 'linear-gradient(to bottom, rgba(7, 9, 15, 0.86) 0%, rgba(7, 9, 15, 0) 100%)',
        }}
      />
    </header>
  );
}
