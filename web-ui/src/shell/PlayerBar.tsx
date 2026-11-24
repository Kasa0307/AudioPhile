import { ChevronDown, Disc3, Maximize2, Radio } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
} from '@/components/icons/Transport';
import { ExplicitBadge } from '@/components/music/ExplicitBadge';
import { FavoriteButton } from '@/components/music/FavoriteButton';
import { TrackMenu } from '@/components/music/TrackMenu';
import { VideoSurface } from '@/components/music/VideoSurface';
import { albumHref } from '@/components/music/links';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { useHasVideo } from '@/state/video';
import { Credits, PageLink, pageLink } from './Lcd';
import { albumPageFor } from './nowPlayingLinks';
import { VolumeControl } from './VolumeControl';
import { WaveformScrubber } from './WaveformScrubber';

const ctrlBtn =
  'grid size-9 place-items-center rounded-full text-secondary transition-[background-color,color,transform] duration-150 hover:bg-white/[0.08] hover:text-primary active:scale-90 disabled:opacity-35';

/**
 * Tactile Digital Hi-Fi Now Playing Upper Deck:
 * - Dynamic artwork accent powers Play/Pause button, active Shuffle/Repeat controls, and album aura
 * - Subtle top Audio Telemetry Pill (when Show Stats is enabled)
 * - Safe-area aware top spacing + swipe-down gesture to dismiss sheet
 */
export function PlayerBar() {
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const status = usePlayer((s) => s.status);
  const error = usePlayer((s) => s.error);
  const showNerdStats = usePlayer((s) => s.showNerdStats);
  const track = usePlayer((s) => {
    const entry = s.queue[s.index]?.track;
    if (entry && entry.videoId === s.nowPlaying?.videoId) return entry;
    if (!s.nowPlaying) return null;
    return {
      videoId: s.nowPlaying.videoId,
      title: s.nowPlaying.title,
      artists: s.nowPlaying.artist ? [{ name: s.nowPlaying.artist, id: null }] : [],
      album: null,
      durationSec: s.nowPlaying.durationSec || null,
      explicit: false,
      thumbnail: s.nowPlaying.artworkUrl,
      index: null,
      plays: null,
    };
  });
  const hasTrack = nowPlaying !== null;
  const videoId = nowPlaying?.videoId ?? null;
  const playing = status === 'playing' || status === 'buffering';
  const hasNext = usePlayer((s) => s.index + 1 < s.queue.length || s.repeat !== 'off' || (s.autoplay && s.index >= 0));
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);
  const { togglePlay, next, previous, toggleShuffle, cycleRepeat } = usePlayer.getState();
  const setFullScreen = useUi((s) => s.setFullScreen);
  const setMobileConsoleOpen = useUi((s) => s.setMobileConsoleOpen);
  const video = useHasVideo(videoId ?? undefined);
  const [volumeOpen, setVolumeOpen] = useState(false);

  const swipeStartY = useRef<number | null>(null);
  const album = track?.album ?? null;
  const telemetryLabel = nowPlaying ? 'HI-RES · 24-bit / 192 kHz' : 'Ready';

  return (
    <section
      aria-label="Player"
      onTouchStart={(e) => {
        swipeStartY.current = e.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(e) => {
        const y0 = swipeStartY.current;
        swipeStartY.current = null;
        const y1 = e.changedTouches[0]?.clientY;
        if (y0 != null && y1 != null && y1 - y0 > 64) {
          triggerHaptic('light');
          setMobileConsoleOpen(false);
        }
      }}
      className="relative flex flex-none flex-col gap-3 border-b border-white/[0.08] bg-[#0a0f1c]/55 px-4 pb-4 backdrop-blur-2xl"
      style={{
        paddingTop: 'max(14px, calc(var(--android-safe-top, 0px) + 10px), calc(env(safe-area-inset-top, 0px) + 10px))',
      }}
    >
      {/* Subtle pull handle */}
      <div className="mx-auto -mt-1 mb-0.5 h-1 w-9 rounded-full bg-white/15 sm:hidden" aria-hidden="true" />

      {/* Top Row: Hide | Optional Audio Telemetry Pill | Expand */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            triggerHaptic('light');
            setMobileConsoleOpen(false);
          }}
          aria-label="Hide Player"
          className="inline-flex h-8 items-center gap-1 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 font-mono text-[10px] font-semibold tracking-[0.08em] text-secondary uppercase backdrop-blur-md transition-colors hover:text-primary active:scale-95 sm:hidden"
        >
          <ChevronDown size={14} />
          <span>Hide</span>
        </button>

        {showNerdStats ? (
          <div
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full border bg-white/[0.04] px-2.5 py-1 font-mono text-[9.5px] font-semibold tracking-[0.04em] backdrop-blur-md"
            style={{
              borderColor: nowPlaying ? 'rgba(var(--accent-rgb), 0.34)' : 'rgba(255,255,255,0.09)',
              color: nowPlaying ? 'var(--accent-bright)' : 'var(--systemTertiary)',
            }}
          >
            <Radio size={10} className={playing ? 'animate-pulse' : ''} />
            <span className="truncate tabular-nums">{telemetryLabel}</span>
          </div>
        ) : (
          <span className="hidden sm:block" />
        )}

        <button
          type="button"
          disabled={!hasTrack}
          onClick={() => {
            triggerHaptic('light');
            setFullScreen(true);
          }}
          aria-label="Expand Stage"
          title="Expand Cinema Stage"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 font-mono text-[10px] font-semibold tracking-[0.08em] text-secondary uppercase backdrop-blur-md transition-colors hover:text-primary active:scale-95 disabled:opacity-35"
        >
          <Maximize2 size={11} />
          <span>Stage</span>
        </button>
      </div>

      {/* Track Artwork + Metadata with smooth cross-swap animation */}
      {nowPlaying ? (
        <div key={nowPlaying.videoId} className="animate-track-swap flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setFullScreen(true);
            }}
            aria-label="Open Cinema Stage"
            className="group/art relative flex-none text-left"
          >
            {/* Dynamic album radial drop-glow */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1.5 rounded-[18px] opacity-65 blur-xl transition-colors duration-700"
              style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.42)' }}
            />
            <div className="relative z-1 size-[74px] overflow-hidden rounded-[14px] bg-[#131b2e] ring-1 ring-white/18 shadow-2xl sm:size-[104px]">
              {nowPlaying.artworkUrl && (
                <img
                  key={nowPlaying.artworkUrl}
                  src={sizedArtwork(nowPlaying.artworkUrl, 240)}
                  alt={nowPlaying.title}
                  referrerPolicy="no-referrer"
                  decoding="async"
                  className="size-full object-cover opacity-0 transition-opacity duration-200 ease-in data-loaded:opacity-100"
                  onLoad={(e) => e.currentTarget.setAttribute('data-loaded', '')}
                />
              )}
              <VideoSurface className={`absolute inset-0 transition-opacity duration-300 ${video ? 'opacity-100' : 'opacity-0'}`} />
            </div>
          </button>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-start gap-1.5">
              <PageLink
                className={`min-w-0 max-w-full line-clamp-2 whitespace-normal break-words text-[16px] font-bold leading-[20px] tracking-[-0.01em] text-primary ${pageLink}`}
                href={albumHref(album?.id ?? null)}
                resolve={() => albumPageFor(nowPlaying.videoId, album, [nowPlaying.title, nowPlaying.artist].filter(Boolean).join(' '))}
              >
                {cleanTrackTitle(nowPlaying.title, nowPlaying.artist)}
              </PageLink>
              {track?.explicit && <ExplicitBadge size={13} />}
            </div>

            <div className="truncate text-[13px] font-medium leading-[18px] text-secondary">
              {error ? (
                <span className="text-red-400">{error}</span>
              ) : nowPlaying.artist ? (
                <Credits videoId={nowPlaying.videoId} line={nowPlaying.artist} artists={track?.artists ?? []} className={pageLink} />
              ) : (
                'Audiophile'
              )}
            </div>

            <div className="mt-1 flex items-center gap-1">
              <FavoriteButton videoId={videoId} className={ctrlBtn} size={16} />
              {track && <TrackMenu track={track} className={ctrlBtn} placement="above-start" />}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3.5 py-1">
          <div
            className="grid size-[68px] flex-none place-items-center rounded-full border border-white/12 text-secondary"
            style={{
              background:
                'radial-gradient(circle at center, rgba(var(--accent-rgb), 0.25) 0%, rgba(var(--accent-rgb), 0.16) 18%, #111827 20%, #07090f 100%)',
            }}
          >
            <Disc3 size={22} strokeWidth={1.6} style={{ color: 'var(--accent-bright)' }} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold text-primary">Not playing</span>
            <span className="text-[12px] leading-relaxed text-secondary">
              Select a track to start listening
            </span>
          </div>
        </div>
      )}

      {/* Luminous Dynamic Waveform Scrubber */}
      <WaveformScrubber variant="deck" />

      {/* Studio Transport Controls — Dynamic Accent Play/Pause & Active States */}
      <div
        className="group/actions relative flex items-center justify-between gap-1"
        data-volume-open={volumeOpen || undefined}
        onPointerLeave={() => setVolumeOpen(false)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setVolumeOpen(false);
        }}
      >
        <button
          className={ctrlBtn}
          aria-label="Shuffle"
          aria-pressed={shuffle}
          style={
            shuffle
              ? {
                  backgroundColor: 'rgba(var(--accent-rgb), 0.2)',
                  color: 'var(--accent-bright)',
                }
              : undefined
          }
          onClick={() => {
            triggerHaptic('light');
            toggleShuffle();
          }}
        >
          <ShuffleIcon size={21} />
        </button>

        <button
          className={ctrlBtn}
          disabled={!hasTrack}
          aria-label="Previous"
          onClick={() => {
            triggerHaptic('light');
            previous();
          }}
        >
          <BackwardIcon size={23} />
        </button>

        <button
          className="grid size-12 place-items-center rounded-full text-white transition-[transform,filter,background-color,box-shadow] duration-300 hover:brightness-110 active:scale-90 disabled:opacity-40"
          style={{
            backgroundColor: 'var(--accent-hex)',
            boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.28)',
          }}
          disabled={!hasTrack}
          aria-label={playing ? 'Pause' : 'Play'}
          onClick={() => {
            triggerHaptic('medium');
            togglePlay();
          }}
        >
          {playing ? <PauseIcon size={23} /> : <PlayIcon size={23} />}
        </button>

        <button
          className={ctrlBtn}
          disabled={!hasTrack || !hasNext}
          aria-label="Next"
          onClick={() => {
            triggerHaptic('light');
            next();
          }}
        >
          <ForwardIcon size={23} />
        </button>

        <button
          className={ctrlBtn}
          aria-label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat'}
          aria-pressed={repeat !== 'off'}
          style={
            repeat !== 'off'
              ? {
                  backgroundColor: 'rgba(var(--accent-rgb), 0.2)',
                  color: 'var(--accent-bright)',
                }
              : undefined
          }
          onClick={() => {
            triggerHaptic('light');
            cycleRepeat();
          }}
        >
          {repeat === 'one' ? <RepeatOneIcon size={21} /> : <RepeatIcon size={21} />}
        </button>

        <VolumeControl open={volumeOpen} onOpen={() => setVolumeOpen(true)} className={ctrlBtn} iconSize={16} />
      </div>
    </section>
  );
}
