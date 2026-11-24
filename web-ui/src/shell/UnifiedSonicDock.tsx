import { Compass, Home, Library, Music2, Pause, Play, Search, SkipForward } from 'lucide-react';
import { useRef, useState } from 'react';
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
 * Unified Floating Sonic Dock with Real-Time Touch Physics & Sliding Active Tab Pill:
 * - Real-time horizontal thumb drag smoothly glides track info before skipping prev/next
 * - Vertical upward drag softly lifts the dock into Now Playing
 * - GPU-accelerated sliding glass pill tracks active tab seamlessly across Home/Explore/Search/Library
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
  const [drag, setDrag] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchOrigin.current = { x: t.clientX, y: t.clientY };
    setDrag({ x: 0, y: 0, active: true });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const start = touchOrigin.current;
    const t = e.touches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDrag({ x: Math.max(-90, Math.min(90, dx * 0.55)), y: 0, active: true });
    } else if (dy < 0) {
      setDrag({ x: 0, y: Math.max(-18, dy * 0.28), active: true });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchOrigin.current;
    touchOrigin.current = null;
    setDrag({ x: 0, y: 0, active: false });
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;

    if (dy < -32 && Math.abs(dy) > Math.abs(dx)) {
      triggerHaptic('medium');
      setMobileConsoleOpen(true);
      return;
    }
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.3 && nowPlaying) {
      triggerHaptic('medium');
      if (dx < 0 && hasNext) next();
      else if (dx > 0) previous();
    }
  };

  const displayTitle = nowPlaying ? cleanTrackTitle(nowPlaying.title, nowPlaying.artist) : 'Audiophile';
  const activeTabIndex = TABS.findIndex((t) => t.match(pathname));

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
        className="pointer-events-auto mx-auto flex w-full max-w-[520px] flex-col overflow-hidden rounded-[24px] border bg-[#0d1322]/86 shadow-[inset_0_1px_0_rgba(255,255,255,0.11),0_18px_42px_rgba(0,0,0,0.72)] backdrop-blur-2xl"
        style={{
          borderColor: nowPlaying ? 'rgba(var(--accent-rgb), 0.28)' : 'rgba(255, 255, 255, 0.1)',
          transform: `translate3d(0, ${drag.y}px, 0)`,
          transition: drag.active
            ? 'border-color 500ms ease'
            : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), border-color 500ms ease',
        }}
      >
        {/* Upper Tier: Interactive Mini-Player with Live Horizontal Swipe Tracking */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchOrigin.current = null;
            setDrag({ x: 0, y: 0, active: false });
          }}
          className="relative flex items-center gap-2.5 px-2.5 py-2"
        >
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
            style={{
              transform: `translate3d(${drag.x}px, 0, 0)`,
              opacity: 1 - Math.min(0.45, Math.abs(drag.x) / 140),
              transition: drag.active
                ? 'none'
                : 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease',
            }}
          >
            <div
              key={nowPlaying?.videoId ?? 'idle'}
              className="animate-track-swap flex min-w-0 flex-1 items-center gap-2.5"
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
            </div>
          </button>

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
            className="grid size-9 flex-none place-items-center rounded-full text-white transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-85 disabled:opacity-35"
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
            className="grid size-8 flex-none place-items-center rounded-full text-secondary transition-[transform,color] duration-150 hover:text-primary active:scale-85 disabled:opacity-30"
          >
            <SkipForward size={16} />
          </button>
        </div>

        {/* Hairline acoustic divider */}
        <div className="mx-3 h-px bg-white/[0.07]" aria-hidden="true" />

        {/* Lower Tier: 4 Core Tabs with Smooth Sliding Active Glass Indicator */}
        <nav aria-label="Primary Navigation" className="relative grid grid-cols-4 items-center p-1.5">
          {activeTabIndex >= 0 && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 w-[calc((100%-12px)/4)] rounded-[16px] transition-[transform,background-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                transform: `translate3d(${activeTabIndex * 100}%, 0, 0)`,
                backgroundColor: 'rgba(var(--accent-rgb), 0.22)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
              }}
            />
          )}

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
                className={`relative z-1 flex flex-col items-center justify-center gap-0.5 rounded-[16px] py-1.5 transition-[color,transform] duration-200 active:scale-92 ${
                  active ? 'text-white' : 'text-secondary hover:text-primary'
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2.3 : 1.9}
                  className="transition-transform duration-200"
                  style={
                    active
                      ? { color: 'var(--accent-bright)', transform: 'scale(1.06)' }
                      : undefined
                  }
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
