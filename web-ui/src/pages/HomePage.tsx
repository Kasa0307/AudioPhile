import { ChevronRight, Play, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { browseHref, hrefFor } from '@/components/music/links';
import { playList, playTrack, shuffleList, toTrack } from '@/components/music/play';
import { LoadError, LoadMoreError, NeedsExtension } from '@/components/music/States';
import { mergeRecentTracks, useLocalRecentTracks } from '@/data/music/localHistory';
import { useHome, useLibrary, useYouTubeReady } from '@/data/music/queries';
import type { MusicItem, Shelf, Track } from '@/data/music/types';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { buildWaveform } from '@/shell/WaveformScrubber';
import { HomeSkeleton } from '@/skeletons/PageSkeletons';
import { ShelfSkeleton } from '@/skeletons/ShelfSkeleton';
import { usePlayer } from '@/state/player';

const RECENT_TITLE = 'Recently Played';
const RECENT_LIMIT = 14;
const RECENT_SOURCE = { title: RECENT_TITLE, type: 'home' as const };

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function useRecentlyPlayed(): Track[] {
  const local = useLocalRecentTracks();
  const history = useLibrary('recent');
  const remote = history.data?.pages[0]?.data.tracks ?? [];
  return mergeRecentTracks(local, remote, RECENT_LIMIT);
}

/** Animated 3-bar active equalizer indicator for currently playing rows. */
function ActiveEq() {
  return (
    <span className="inline-flex h-3.5 items-end gap-[2px]" aria-label="Playing">
      {[0, 160, 320].map((delay, i) => (
        <span
          key={i}
          className="w-[2.5px] animate-sonic-eq rounded-full"
          style={{
            height: '100%',
            backgroundColor: i === 1 ? 'var(--accent-hex)' : 'var(--accent-bright)',
            animationDelay: `${delay}ms`,
          }}
        />
      ))}
    </span>
  );
}

/** Clean minimal section header letting the title breathe naturally. */
function LoungeSectionHeader({
  title,
  to,
}: {
  index?: string;
  title: string;
  to?: string | null;
  meta?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2 px-4">
      <h2 className="truncate text-[19px] font-bold tracking-[-0.02em] text-primary">
        {to ? (
          <PrefetchLink to={to} className="inline-flex items-center gap-1 hover:opacity-90">
            <span>{title}</span>
            <ChevronRight size={17} className="text-secondary" />
          </PrefetchLink>
        ) : (
          title
        )}
      </h2>
    </div>
  );
}

/**
 * Editorial Vinyl/CD Hero Stage ("Continue Listening"):
 * Frameless floating stage with album cover + subtle peeking vinyl disc,
 * compact interactive mini-waveform preview, and tactile Resume / Shuffle Mix controls.
 */
function HeroVinylStage({
  heroTrack,
  heroPool,
  isPlayingHero,
}: {
  heroTrack: Track;
  heroPool: Track[];
  isPlayingHero: boolean;
}) {
  const heroArtist = heroTrack.artists.map((a) => a.name).filter(Boolean).join(', ') || 'Audiophile Mix';
  const heroTitle = cleanTrackTitle(heroTrack.title, heroArtist);
  const heroContext = { source: { title: 'Continue Listening', type: 'home' as const } };
  const previewBars = useMemo(() => buildWaveform(heroTrack.videoId, 28), [heroTrack.videoId]);
  const playedCutoff = isPlayingHero ? 14 : 9;

  return (
    <section aria-label="Continue Listening" className="relative px-4 pt-2 pb-6">
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center gap-5">
          {/* Album Artwork + Subtle Peeking Vinyl Disc */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              const idx = Math.max(0, heroPool.findIndex((t) => t.videoId === heroTrack.videoId));
              void playList(heroPool, idx, heroContext);
            }}
            className="group relative flex-none pr-6 text-left active:scale-[0.97] transition-transform duration-200"
            aria-label={`Resume ${heroTitle}`}
          >
            {/* Dynamic ambient aura */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-2 rounded-full opacity-55 blur-2xl transition-colors duration-700"
              style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.35)' }}
            />

            {/* Peeking Vinyl Disc */}
            <div
              aria-hidden="true"
              className={`absolute top-1.5 right-0 z-0 size-[96px] rounded-full border border-white/[0.12] bg-[repeating-radial-gradient(circle_at_center,#141926_0px,#141926_2px,#090c14_3px,#090c14_5px)] shadow-[0_8px_24px_rgba(0,0,0,0.65)] ${
                isPlayingHero ? 'animate-vinyl-spin' : ''
              }`}
            >
              <span
                className="absolute top-1/2 left-1/2 size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20"
                style={{
                  background: 'radial-gradient(circle, var(--accent-bright) 0%, var(--accent-hex) 70%)',
                }}
              />
              <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#07090f]" />
            </div>

            {/* Album Sleeve */}
            <div className="relative z-1 size-[108px] overflow-hidden rounded-[16px] bg-[#121828] ring-1 ring-white/18 shadow-[0_14px_32px_rgba(0,0,0,0.6)]">
              {heroTrack.thumbnail ? (
                <img
                  src={sizedArtwork(heroTrack.thumbnail, 260)}
                  alt={heroTitle}
                  referrerPolicy="no-referrer"
                  className="size-full object-cover"
                />
              ) : (
                <div className="size-full bg-white/[0.06]" />
              )}
            </div>
          </button>

          {/* Editorial Title, Artist & Mini-Waveform */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span
              className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase"
              style={{ color: 'var(--accent-bright)' }}
            >
              CONTINUE LISTENING
            </span>
            <h1 className="line-clamp-2 text-[20px] font-bold leading-[24px] tracking-[-0.02em] text-primary">
              {heroTitle}
            </h1>
            <p className="truncate text-[13.5px] font-medium text-secondary">{heroArtist}</p>

            {/* Compact Interactive Mini-Waveform Preview */}
            <div
              onClick={() => {
                triggerHaptic('medium');
                const idx = Math.max(0, heroPool.findIndex((t) => t.videoId === heroTrack.videoId));
                void playList(heroPool, idx, heroContext);
              }}
              className="mt-2 flex h-5 cursor-pointer items-center gap-[2px]"
              aria-hidden="true"
            >
              {previewBars.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full transition-colors duration-300"
                  style={{
                    height: `${Math.max(24, Math.round(h * 0.85))}%`,
                    background:
                      i <= playedCutoff
                        ? 'linear-gradient(to top, var(--accent-hex), var(--accent-bright))'
                        : 'rgba(255, 255, 255, 0.16)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Tactile Glass Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('medium');
              const idx = Math.max(0, heroPool.findIndex((t) => t.videoId === heroTrack.videoId));
              void playList(heroPool, idx, heroContext);
            }}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-white transition-all duration-150 active:scale-[0.96]"
            style={{
              backgroundColor: 'var(--accent-hex)',
              boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.4), inset 0 1px 0 rgba(255,255,255,0.24)',
            }}
          >
            <Play size={14} fill="currentColor" />
            <span>Resume</span>
          </button>

          {heroPool.length > 1 && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                void shuffleList(heroPool, heroContext);
              }}
              className="acoustic-glass inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13.5px] font-semibold text-primary transition-all duration-150 hover:bg-white/[0.1] active:scale-[0.96]"
            >
              <Shuffle size={14} style={{ color: 'var(--accent-bright)' }} />
              <span>Shuffle Mix</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Quick Picks: 3-row Focused Editorial Pages (Horizontal Snap-Scroll, zero right-edge clipping)
 * with monospace track numbers & live active equalizer indicator.
 */
function QuickPicksEditorialDeck({
  shelf,
  sectionIndex,
  playingId,
  isPlaying,
}: {
  shelf: Shelf;
  sectionIndex: string;
  playingId: string | null;
  isPlaying: boolean;
}) {
  const pages: MusicItem[][] = [];
  for (let i = 0; i < shelf.items.length; i += 3) {
    pages.push(shelf.items.slice(i, i + 3));
  }
  if (!pages.length) return null;

  return (
    <section aria-label={shelf.title} className="pb-6">
      <LoungeSectionHeader
        index={sectionIndex}
        title={shelf.title}
        to={shelf.seeAll ? browseHref(shelf.seeAll) : null}
        meta={`${shelf.items.length} TRACKS`}
      />
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
        {pages.map((group, pageIdx) => (
          <div
            key={pageIdx}
            className="acoustic-glass flex w-[88vw] max-w-[400px] flex-none snap-start flex-col divide-y divide-white/[0.06] rounded-[20px] p-1.5"
          >
            {group.map((item, rowIdx) => {
              const num = pageIdx * 3 + rowIdx + 1;
              const artist = item.artists.map((a) => a.name).filter(Boolean).join(', ') || item.subtitle;
              const title = cleanTrackTitle(item.title, artist);
              const active = playingId === item.id;
              const dur = formatDuration(item.durationSec);

              return (
                <button
                  key={`${item.id}-${num}`}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    playTrack(item);
                  }}
                  className="group flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
                  style={active ? { backgroundColor: 'rgba(var(--accent-rgb), 0.14)' } : undefined}
                >
                  <span
                    className="w-5 flex-none font-mono text-[11px] font-semibold tabular-nums"
                    style={{ color: active ? 'var(--accent-bright)' : 'var(--systemTertiary)' }}
                  >
                    {pad2(num)}
                  </span>

                  <div className="relative size-11 flex-none overflow-hidden rounded-[10px] bg-white/[0.05] ring-1 ring-white/10">
                    {item.thumbnail && (
                      <img
                        src={sizedArtwork(item.thumbnail, 120)}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span
                      className="truncate text-[14px] font-semibold leading-tight"
                      style={{ color: active ? 'var(--accent-bright)' : 'var(--systemPrimary)' }}
                    >
                      {title}
                    </span>
                    <span className="mt-0.5 truncate text-[12px] text-secondary">{artist}</span>
                  </div>

                  {active && isPlaying ? (
                    <ActiveEq />
                  ) : dur ? (
                    <span className="flex-none font-mono text-[11px] text-tertiary tabular-nums">{dur}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Curated Bento Card Cluster (Asymmetric editorial layout for Recommended / Mix shelves):
 * Featured hero square tile on left + 3 compact stacked tracks on right.
 */
function CuratedBentoShelf({
  shelf,
  sectionIndex,
  playingId,
  isPlaying,
}: {
  shelf: Shelf;
  sectionIndex: string;
  playingId: string | null;
  isPlaying: boolean;
}) {
  const clusters: MusicItem[][] = [];
  for (let i = 0; i < shelf.items.length; i += 4) {
    const chunk = shelf.items.slice(i, i + 4);
    if (chunk.length >= 2) clusters.push(chunk);
  }
  if (!clusters.length) return null;

  return (
    <section aria-label={shelf.title} className="pb-6">
      <LoungeSectionHeader
        index={sectionIndex}
        title={shelf.title}
        to={shelf.seeAll ? browseHref(shelf.seeAll) : null}
        meta="CURATED MIX"
      />
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
        {clusters.map((chunk, idx) => {
          const lead = chunk[0]!;
          const rest = chunk.slice(1, 4);
          const leadArtist = lead.artists.map((a) => a.name).filter(Boolean).join(', ') || lead.subtitle;
          const leadTitle = cleanTrackTitle(lead.title, leadArtist);
          const leadHref = hrefFor(lead);
          const leadPlayable = lead.kind === 'song' || lead.kind === 'video';

          const leadCardContent = (
            <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-[16px] bg-[#12192a] ring-1 ring-white/12">
              {lead.thumbnail && (
                <img
                  src={sizedArtwork(lead.thumbnail, 320)}
                  alt={leadTitle}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,9,15,0.92)_12%,rgba(7,9,15,0.28)_60%,transparent)]" />
              <div className="relative z-1 flex flex-col p-2.5">
                <span className="line-clamp-2 text-[13.5px] font-bold leading-snug text-white">
                  {leadTitle}
                </span>
                <span className="mt-0.5 truncate text-[11px] text-white/75">{leadArtist}</span>
              </div>
            </div>
          );

          return (
            <div
              key={`${lead.id}-${idx}`}
              className="acoustic-glass grid w-[90vw] max-w-[420px] flex-none snap-start grid-cols-[41%_minmax(0,1fr)] gap-2.5 rounded-[22px] p-2.5"
            >
              {leadPlayable || !leadHref ? (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    playTrack(lead);
                  }}
                  className="group min-h-[168px] text-left active:scale-[0.98] transition-transform"
                >
                  {leadCardContent}
                </button>
              ) : (
                <PrefetchLink to={leadHref} className="group min-h-[168px] active:scale-[0.98] transition-transform">
                  {leadCardContent}
                </PrefetchLink>
              )}

              <div className="flex min-w-0 flex-col justify-between gap-1.5">
                {rest.map((item, rIdx) => {
                  const artist = item.artists.map((a) => a.name).filter(Boolean).join(', ') || item.subtitle;
                  const title = cleanTrackTitle(item.title, artist);
                  const active = playingId === item.id;
                  const itemHref = hrefFor(item);
                  const isPlayable = item.kind === 'song' || item.kind === 'video';

                  const inner = (
                    <>
                      <div className="size-10 flex-none overflow-hidden rounded-[9px] bg-white/[0.06] ring-1 ring-white/10">
                        {item.thumbnail && (
                          <img
                            src={sizedArtwork(item.thumbnail, 100)}
                            alt=""
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className="truncate text-[12.5px] font-semibold leading-tight"
                          style={{ color: active ? 'var(--accent-bright)' : 'var(--systemPrimary)' }}
                        >
                          {title}
                        </span>
                        <span className="mt-0.5 truncate text-[11px] text-secondary">{artist}</span>
                      </div>
                      {active && isPlaying && <ActiveEq />}
                    </>
                  );

                  return isPlayable || !itemHref ? (
                    <button
                      key={`${item.id}-${rIdx}`}
                      type="button"
                      onClick={() => {
                        triggerHaptic('light');
                        playTrack(item);
                      }}
                      className="flex items-center gap-2 rounded-[12px] bg-white/[0.04] p-1.5 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.98]"
                    >
                      {inner}
                    </button>
                  ) : (
                    <PrefetchLink
                      key={`${item.id}-${rIdx}`}
                      to={itemHref}
                      className="flex items-center gap-2 rounded-[12px] bg-white/[0.04] p-1.5 text-left transition-colors hover:bg-white/[0.08] active:scale-[0.98]"
                    >
                      {inner}
                    </PrefetchLink>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Vinyl Sleeve Cards for Mood, Genre, Album & Playlist Shelves:
 * Subtle vinyl disc rim peeking above the sleeve + glassmorphic bottom label strip.
 */
function VinylSleeveShelf({ shelf, sectionIndex }: { shelf: Shelf; sectionIndex: string }) {
  if (!shelf.items.length) return null;

  return (
    <section aria-label={shelf.title} className="pb-6">
      <LoungeSectionHeader
        index={sectionIndex}
        title={shelf.title}
        to={shelf.seeAll ? browseHref(shelf.seeAll) : null}
        meta={shelf.layout === 'circle' ? 'ARTISTS' : 'VINYL SLEEVES'}
      />

      <div className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pt-1">
        {shelf.items.map((item, i) => {
          const subtitle = item.subtitle || item.artists.map((a) => a.name).filter(Boolean).join(', ');
          const title = cleanTrackTitle(item.title, subtitle);
          const href = hrefFor(item);
          const playable = item.kind === 'song' || item.kind === 'video';
          const isArtist = shelf.layout === 'circle' || item.kind === 'artist';

          const card = isArtist ? (
            <div className="flex w-[124px] flex-col items-center gap-2 text-center">
              <div className="relative size-[116px] overflow-hidden rounded-full bg-[#131a2c] ring-1 ring-white/15 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
                {item.thumbnail && (
                  <img
                    src={sizedArtwork(item.thumbnail, 240)}
                    alt={title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </div>
              <span className="line-clamp-1 text-[13px] font-semibold text-primary">{title}</span>
              <span className="font-mono text-[10px] tracking-[0.06em] text-tertiary uppercase">ARTIST</span>
            </div>
          ) : (
            <div className="group relative w-[156px] pt-1.5">
              {/* Subtle vinyl sleeve top lip */}
              <div
                aria-hidden="true"
                className="mx-3 h-1.5 rounded-t-[8px] border-x border-t border-white/[0.12] bg-white/[0.06]"
              />
              <div className="relative aspect-square w-full overflow-hidden rounded-[16px] border border-white/[0.11] bg-[#12192b] shadow-[0_14px_30px_rgba(0,0,0,0.52)] transition-transform duration-200 group-active:scale-[0.96]">
                {item.thumbnail && (
                  <img
                    src={sizedArtwork(item.thumbnail, 320)}
                    alt={title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                {/* Frosted glassmorphic bottom label strip */}
                <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.1] bg-[#07090f]/75 px-2.5 py-2 backdrop-blur-md">
                  <span className="block truncate text-[12.5px] font-semibold leading-tight text-white">
                    {title}
                  </span>
                  {subtitle && (
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-white/65">
                      {subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );

          return playable || !href ? (
            <button
              key={`${item.id}-${i}`}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                playTrack(item);
              }}
              className="flex-none snap-start text-left"
            >
              {card}
            </button>
          ) : (
            <PrefetchLink key={`${item.id}-${i}`} to={href} className="flex-none snap-start text-left">
              {card}
            </PrefetchLink>
          );
        })}
      </div>
    </section>
  );
}

/** Compact Horizontal Recently Played Strip (Single-track play on tap, never spams queue). */
function RecentlyPlayedStrip({
  tracks,
  sectionIndex,
  playingId,
  isPlaying,
}: {
  tracks: Track[];
  sectionIndex: string;
  playingId: string | null;
  isPlaying: boolean;
}) {
  if (!tracks.length) return null;
  return (
    <section aria-label={RECENT_TITLE} className="pb-6">
      <LoungeSectionHeader
        index={sectionIndex}
        title={RECENT_TITLE}
        to="/library/recent"
        meta={`${tracks.length} PLAYED`}
      />
      <div className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4">
        {tracks.map((track) => {
          const artist = track.artists.map((a) => a.name).filter(Boolean).join(', ');
          const title = cleanTrackTitle(track.title, artist);
          const active = playingId === track.videoId;
          return (
            <button
              key={track.videoId}
              type="button"
              onClick={() => {
                triggerHaptic('light');
                playTrack(track, null, RECENT_SOURCE);
              }}
              className="acoustic-glass flex w-[188px] flex-none snap-start items-center gap-2.5 rounded-[16px] p-2 text-left transition-transform active:scale-[0.96]"
              style={active ? { borderColor: 'rgba(var(--accent-rgb), 0.5)' } : undefined}
            >
              <div className="size-11 flex-none overflow-hidden rounded-[10px] bg-white/[0.06] ring-1 ring-white/12">
                {track.thumbnail && (
                  <img
                    src={sizedArtwork(track.thumbnail, 120)}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  className="truncate text-[13px] font-semibold leading-tight"
                  style={{ color: active ? 'var(--accent-bright)' : 'var(--systemPrimary)' }}
                >
                  {title}
                </span>
                <span className="mt-0.5 truncate text-[11px] text-secondary">{artist || 'Track'}</span>
              </div>
              {active && isPlaying && <ActiveEq />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * HOME SCREEN ("The Listening Lounge"):
 * Varied editorial visual rhythm: Vinyl Hero Stage -> Quick Picks 3-row Deck ->
 * Recently Played Strip -> Curated Bento Clusters -> Vinyl Sleeve Mood Shelves.
 */
export default function HomePage() {
  const { missing } = useYouTubeReady();
  const home = useHome();
  const recent = useRecentlyPlayed();
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const status = usePlayer((s) => s.status);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !home.hasNextPage || home.isFetchNextPageError) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !home.isFetchingNextPage) void home.fetchNextPage();
      },
      { root: document.getElementById('scrollable-page'), rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [home.hasNextPage, home.isFetchingNextPage, home.isFetchNextPageError, home.fetchNextPage]);

  if (missing) return <NeedsExtension />;
  if (home.isError && !home.data) return <LoadError error={home.error} onRetry={() => void home.refetch()} />;
  if (!home.data) return <HomeSkeleton />;

  const rawShelves = home.data.pages.flatMap((page) => page.data).filter((shelf) => {
    const lower = shelf.title.trim().toLowerCase();
    if (lower === 'your playlists') return false;
    if (recent.length > 0 && lower === RECENT_TITLE.toLowerCase()) return false;
    return true;
  });

  const shelfSongs: Track[] = [];
  const seenSongIds = new Set<string>();
  for (const shelf of rawShelves) {
    for (const item of shelf.items) {
      if ((item.kind === 'song' || item.kind === 'video') && !seenSongIds.has(item.id)) {
        seenSongIds.add(item.id);
        shelfSongs.push(toTrack(item));
      }
    }
  }

  const playingId = nowPlaying?.videoId ?? null;
  const isPlaying = status === 'playing' || status === 'buffering';
  const heroPool = recent.length > 0 ? recent : shelfSongs;
  const heroTrack: Track | null =
    heroPool.find((t) => t.videoId === playingId) ?? heroPool[0] ?? null;

  const heroCleanTitle = heroTrack
    ? cleanTrackTitle(heroTrack.title, heroTrack.artists[0]?.name).toLowerCase()
    : null;

  // Deduplicate heroTrack from the primary Quick Picks shelf so the same song isn't repeated right below.
  const shelves = rawShelves.map((shelf, idx) => {
    if (idx !== 0 && !/^quick picks$/i.test(shelf.title.trim())) return shelf;
    const filtered = shelf.items.filter((item) => {
      if (heroTrack && item.id === heroTrack.videoId) return false;
      const clean = cleanTrackTitle(item.title, item.artists[0]?.name ?? item.subtitle).toLowerCase();
      return !(heroCleanTitle && clean === heroCleanTitle);
    });
    return filtered.length >= 3 ? { ...shelf, items: filtered } : shelf;
  });

  let sectionCounter = 1;
  const nextIndex = () => pad2(sectionCounter++);

  return (
    <div className="flex flex-col pt-1">
      {heroTrack && (
        <HeroVinylStage
          heroTrack={heroTrack}
          heroPool={heroPool}
          isPlayingHero={isPlaying && playingId === heroTrack.videoId}
        />
      )}

      {shelves.map((shelf, idx) => {
        const isFirstTracks = idx === 0 || (shelf.layout === 'tracks' && /quick picks/i.test(shelf.title));
        if (isFirstTracks && shelf.layout === 'tracks') {
          return (
            <div key={`${shelf.title}-${idx}`}>
              <QuickPicksEditorialDeck
                shelf={shelf}
                sectionIndex={nextIndex()}
                playingId={playingId}
                isPlaying={isPlaying}
              />
              {idx === 0 && recent.length > 0 && (
                <RecentlyPlayedStrip
                  tracks={recent}
                  sectionIndex={nextIndex()}
                  playingId={playingId}
                  isPlaying={isPlaying}
                />
              )}
            </div>
          );
        }

        // Second track-heavy or recommended shelf renders as an asymmetric Curated Bento Cluster.
        if (shelf.layout === 'tracks' || /recommend|mixed for|from your|listen again/i.test(shelf.title)) {
          return (
            <CuratedBentoShelf
              key={`${shelf.title}-${idx}`}
              shelf={shelf}
              sectionIndex={nextIndex()}
              playingId={playingId}
              isPlaying={isPlaying}
            />
          );
        }

        return <VinylSleeveShelf key={`${shelf.title}-${idx}`} shelf={shelf} sectionIndex={nextIndex()} />;
      })}

      {/* Fallback if Recently Played wasn't inserted after shelf 0 */}
      {shelves.length === 0 && recent.length > 0 && (
        <RecentlyPlayedStrip
          tracks={recent}
          sectionIndex={nextIndex()}
          playingId={playingId}
          isPlaying={isPlaying}
        />
      )}

      <div ref={sentinel} />
      {home.isFetchingNextPage && <ShelfSkeleton kind="square" />}
      {home.isFetchNextPageError && (
        <LoadMoreError onRetry={() => void home.fetchNextPage()} />
      )}
    </div>
  );
}
