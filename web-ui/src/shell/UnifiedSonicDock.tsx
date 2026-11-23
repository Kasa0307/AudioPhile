import { Compass, Home, Library, Music2, Pause, Play, Search, SkipForward } from 'lucide-react';
import { useRef } from 'react';
import { useLocation } from 'react-router';
import { PrefetchNavLink } from '@/components/PrefetchLink';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';

const TABS = [
  { to: '/home', label: 'Home', Icon: Home, match: (p: string) => p === '/' || p.startsWith('/home') },
  { to: '/new', label: 'Explore', Icon: Compass, match: (p: string) => p.startsWith('/new') },
  { to: '/search', label: 'Search', Icon: Search, match: (p: string) => p.startsWith('/search') },
  { to: '/library/playlists', label: 'Library', Icon: Library, match: (p: string) => p.startsWith('/library') },
] as const;

const MICRO_BARS = [42, 82, 58, 95, 64];

/**
 * Unified Floating Sonic Dock:
 * - Soft obsidian gradient mask underneath so scrolled content fades cleanly (zero peeking gaps)
 * - Upper Tier: Interactive Mini-Player with live dynamic-tinted micro-waveform,
 *   swipe left/right to skip track, swipe up/tap to open Now Playing sheet
 * - Lower Tier: 4 core destinations (Home, Explore, Search, Library) inside the same Acoustic Glass vessel
 */
export function UnifiedSonicDock() {
  const { pathname } = useLocation();
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const status = usePlayer((s) => s.status);
  const playing = status === 'playing' || status === 'buffering';
  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || s.repeat !== 'off' || (s.autoplay && s.index >= 0));
  const { togglePlay, next, previous } = usePlayer.getState();
  const setMobileConsoleOpen = useUi((s) => s.setMobileConsoleOpen);

  const touchOrigin = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchOrigin.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchOrigin.current;
    touchOrigin.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    // Swipe up opens Now Playing console
    if (dy < -32 && Math.abs(dy) > Math.abs(dx)) {
      triggerHaptic('medium');
      setMobileConsoleOpen(true);
      return;
    }
    // Horizontal swipe skips tracks
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4 && nowPlaying) {
      triggerHaptic('medium');
      if (dx < 0 && hasNext) next();
      else if (dx > 0) previous();
    }
  };

  const displayTitle = nowPlaying ? cleanTrackTitle(nowPlaying.title, nowPlaying.artist) : 'Audiophile';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[calc(var(--z-web-chrome)-1)] flex flex-col px-3 pt-7"
      style={{
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        background:
          'linear-gradient(to top, #07090f 46%, rgba(7, 9, 15, 0.88) 74%, rgba(7, 9, 15, 0) 100%)',
      }}
    >
      <div
        className="pointer-events-auto mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-[24px] border bg-[#0d1322]/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_18px_42px_rgba(0,0,0,0.72)] backdrop-blur-2xl transition-[border-color] duration-500"
        style={{
          borderColor: nowPlaying ? 'rgba(var(--accent-rgb), 0.28)' : 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Upper Tier: Interactive Mini-Player */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative flex items-center gap-2.5 px-2.5 py-2"
        >
          {/* Subtle top ambient sheen inside dock */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-75"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(var(--accent-rgb), 0.55), transparent)',
            }}
          />

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setMobileConsoleOpen(true);
            }}
            aria-label="Open Now Playing"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <div
              className="relative grid size-[42px] flex-none place-items-center overflow-hidden rounded-[11px] bg-[#141c2f] ring-1 ring-white/15"
              style={{
                boxShadow: nowPlaying ? '0 4px 16px rgba(var(--accent-rgb), 0.28)' : undefined,
              }}
            >
              {nowPlaying?.artworkUrl ? (
                <img
                  src={sizedArtwork(nowPlaying.artworkUrl, 120)}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="size-full object-cover"
                />
              ) : (
                <Music2 size={17} className="text-secondary" />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13.5px] font-semibold leading-tight text-primary">
                {displayTitle}
              </span>
              <span className="mt-0.5 truncate text-[11.5px] font-medium leading-tight text-secondary">
                {nowPlaying ? nowPlaying.artist || 'Now Playing' : 'Select a track'}
              </span>
            </div>
          </button>

          {/* Live animated micro-waveform tinted with track's extracted accent color */}
          {nowPlaying && (
            <div className="mr-0.5 flex h-4 items-end gap-[2px]" aria-hidden="true">
              {MICRO_BARS.map((h, i) => (
                <span
                  key={i}
                  className={`w-[2.5px] rounded-full transition-all duration-300 ${playing ? 'animate-sonic-eq' : ''}`}
                  style={{
                    height: playing ? `${h}%` : `${Math.max(25, Math.round(h * 0.45))}%`,
                    backgroundColor: i % 2 === 0 ? 'var(--accent-bright)' : 'var(--accent-hex)',
                    animationDelay: `${i * 140}ms`,
                    opacity: playing ? 0.95 : 0.4,
                  }}
                />
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={!nowPlaying}
            onClick={() => {
              triggerHaptic('medium');
              togglePlay();
            }}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid size-9 flex-none place-items-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-35"
            style={{
              backgroundColor: nowPlaying ? 'var(--accent-hex)' : 'rgba(255,255,255,0.1)',
              boxShadow: nowPlaying ? '0 4px 14px rgba(var(--accent-rgb), 0.42)' : undefined,
            }}
          >
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>

          <button
            type="button"
            disabled={!nowPlaying || !hasNext}
            onClick={() => {
              triggerHaptic('light');
              next();
            }}
            aria-label="Next track"
            className="grid size-8 flex-none place-items-center rounded-full text-secondary transition-colors hover:text-primary active:scale-90 disabled:opacity-30"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Hairline acoustic divider */}
        <div className="mx-3 h-px bg-white/[0.07]" aria-hidden="true" />

        {/* Lower Tier: 4 Core Navigation Destinations */}
        <nav aria-label="Primary Navigation" className="grid grid-cols-4 items-center gap-1 px-1.5 py-1.5">
          {TABS.map(({ to, label, Icon, match }) => {
            const active = match(pathname);
            return (
              <PrefetchNavLink
                key={to}
                to={to}
                onClick={() => {
                  triggerHaptic('light');
                  setMobileConsoleOpen(false);
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 rounded-[16px] py-1.5 transition-all duration-200 ${
                  active ? 'text-white' : 'text-secondary hover:text-primary'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: 'rgba(var(--accent-rgb), 0.22)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                      }
                    : undefined
                }
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2.3 : 1.9}
                  style={active ? { color: 'var(--accent-bright)' } : undefined}
                />
                <span className="text-[10px] font-semibold leading-tight tracking-[0.02em]">{label}</span>
              </PrefetchNavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
