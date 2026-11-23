import { Compass, Home, Library, Music2, Pause, Play, Search, Settings, SkipForward } from 'lucide-react';
import { PrefetchNavLink } from '@/components/PrefetchLink';
import { sizedArtwork } from '@/lib/artwork';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';

const TABS = [
  { to: '/home', label: 'Home', Icon: Home },
  { to: '/new', label: 'Explore', Icon: Compass },
  { to: '/search', label: 'Search', Icon: Search },
  { to: '/library/playlists', label: 'Library', Icon: Library },
  { to: '/settings', label: 'Settings', Icon: Settings },
] as const;

/**
 * Mobile-first Midnight Blue Glassmorphism bottom control dock (< 640px):
 * 1) Floating Mini-Player capsule (tappable to open the full Studio Console sheet,
 *    with a quick Lyrics button, Play/Pause and Next)
 * 2) Floating 5-tab navigation dock putting all primary destinations at thumb level
 */
export function MobileBottomDock() {
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const status = usePlayer((s) => s.status);
  const playing = status === 'playing' || status === 'buffering';
  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || s.repeat !== 'off' || (s.autoplay && s.index >= 0));
  const { togglePlay, next } = usePlayer.getState();
  const setMobileConsoleOpen = useUi((s) => s.setMobileConsoleOpen);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-[calc(var(--z-web-chrome)-1)] hidden flex-col gap-2 px-3 max-sm:flex">
      {/* Floating Mini-Player capsule */}
      <div className="pointer-events-auto flex items-center gap-2.5 rounded-[18px] border border-white/[0.12] bg-[#0b152b]/82 p-2 pr-2.5 shadow-[0_12px_32px_rgba(3,7,18,0.55)] backdrop-blur-2xl">
        <button
          type="button"
          onClick={() => setMobileConsoleOpen(true)}
          aria-label="Open Studio Player"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div className="grid size-[42px] flex-none place-items-center overflow-hidden rounded-[10px] bg-[#131c31] ring-1 ring-white/12">
            {nowPlaying?.artworkUrl ? (
              <img
                src={sizedArtwork(nowPlaying.artworkUrl, 120)}
                alt=""
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            ) : (
              <Music2 size={18} className="text-secondary" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate type-body-emphasized text-primary">
              {nowPlaying ? nowPlaying.title : 'Audiophile'}
            </span>
            <span className="truncate type-callout text-secondary">
              {nowPlaying ? nowPlaying.artist || 'Playing' : 'Tap to open Player & Lyrics'}
            </span>
          </div>
        </button>

        <button
          type="button"
          disabled={!nowPlaying}
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="grid size-9 flex-none place-items-center rounded-full bg-white/[0.1] text-white transition-transform active:scale-90 disabled:opacity-35"
        >
          {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </button>
        <button
          type="button"
          disabled={!nowPlaying || !hasNext}
          onClick={next}
          aria-label="Next"
          className="grid size-8 flex-none place-items-center rounded-full text-secondary transition-colors hover:text-primary active:scale-90 disabled:opacity-35"
        >
          <SkipForward size={16} />
        </button>
      </div>

      {/* Floating Bottom Navigation Dock */}
      <nav
        aria-label="Mobile Navigation"
        className="pointer-events-auto grid grid-cols-5 items-center gap-1 rounded-[20px] border border-white/[0.12] bg-[#091224]/85 p-1.5 shadow-[0_12px_32px_rgba(3,7,18,0.55)] backdrop-blur-2xl"
      >
        {TABS.map(({ to, label, Icon }) => (
          <PrefetchNavLink
            key={to}
            to={to}
            onClick={() => setMobileConsoleOpen(false)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-[14px] py-1.5 text-secondary transition-all duration-150 hover:text-primary aria-[current=page]:bg-key-bg/90 aria-[current=page]:text-white aria-[current=page]:shadow-[0_4px_14px_rgba(75,114,230,0.32)]"
          >
            <Icon size={17} strokeWidth={2} />
            <span className="text-[10px] font-medium leading-tight">{label}</span>
          </PrefetchNavLink>
        ))}
      </nav>
    </div>
  );
}
