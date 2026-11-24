import { ChevronRight, Film, Play } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { browseHref, hrefFor } from '@/components/music/links';
import { playTrack } from '@/components/music/play';
import { LoadError, NeedsExtension } from '@/components/music/States';
import { useExplore, useYouTubeReady } from '@/data/music/queries';
import type { MusicItem, Shelf } from '@/data/music/types';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { NewSkeleton } from '@/skeletons/PageSkeletons';
import { usePlayer } from '@/state/player';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function CrateHeader({ title, to }: { index?: string; title: string; to?: string | null; badge?: string }) {
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
 * Featured Spotlight Editorial Snap Carousel ("New Albums & Singles"):
 * Large cards with blurred ambient backdrop reflection, monospace release tag, and quick play.
 */
function SpotlightCarousel({ shelf, index }: { shelf: Shelf; index: string }) {
  if (!shelf.items.length) return null;
  return (
    <section aria-label={shelf.title} className="pb-6">
      <CrateHeader
        index={index}
        title={shelf.title}
        to={shelf.seeAll ? browseHref(shelf.seeAll) : null}
        badge="SPOTLIGHT RELEASES"
      />
      <div className="no-scrollbar smooth-scroll flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2">
        {shelf.items.map((item, i) => {
          const href = hrefFor(item);
          const artist = item.artists.map((a) => a.name).filter(Boolean).join(', ') || item.subtitle;
          const title = cleanTrackTitle(item.title, artist);
          const tag = item.kind === 'album' ? 'ALBUM' : item.kind === 'playlist' ? 'COLLECTION' : 'RELEASE';
          const playable = item.kind === 'song' || item.kind === 'video';

          const cardInner = (
            <div className="acoustic-glass-elevated group relative flex w-[76vw] max-w-[300px] flex-col overflow-hidden rounded-[24px] p-3 transition-transform duration-200 active:scale-[0.97]">
              {/* Blurred Ambient Backdrop Reflection */}
              {item.thumbnail && (
                <img
                  src={sizedArtwork(item.thumbnail, 140)}
                  alt=""
                  aria-hidden="true"
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  className="pointer-events-none absolute -top-6 -left-6 size-48 scale-125 rounded-full object-cover opacity-30 blur-3xl saturate-150"
                />
              )}

              <div className="relative z-1 aspect-square w-full overflow-hidden rounded-[16px] bg-[#121828] ring-1 ring-white/15 shadow-[0_14px_32px_rgba(0,0,0,0.55)]">
                {item.thumbnail && (
                  <img
                    src={sizedArtwork(item.thumbnail, 420)}
                    alt={title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                {/* Monospace Release Tag */}
                <span className="absolute top-2.5 left-2.5 rounded-full border border-white/15 bg-[#07090f]/75 px-2.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.1em] text-white uppercase backdrop-blur-md">
                  {tag}
                </span>

                {/* Quick Play Pill */}
                <span
                  aria-hidden="true"
                  className="absolute right-2.5 bottom-2.5 grid size-10 place-items-center rounded-full text-white shadow-[0_8px_22px_rgba(0,0,0,0.55)] backdrop-blur-md"
                  style={{ backgroundColor: 'var(--accent-hex)' }}
                >
                  <Play size={16} fill="currentColor" className="translate-x-[1px]" />
                </span>
              </div>

              <div className="relative z-1 mt-3 flex flex-col gap-0.5 px-0.5">
                <span className="truncate text-[16px] font-bold tracking-[-0.01em] text-primary">{title}</span>
                <span className="truncate text-[12.5px] font-medium text-secondary">{artist || item.subtitle}</span>
              </div>
            </div>
          );

          return playable || !href ? (
            <button
              key={`${item.id}-${i}`}
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                playTrack(item);
              }}
              className="flex-none snap-start text-left"
            >
              {cardInner}
            </button>
          ) : (
            <PrefetchLink
              key={`${item.id}-${i}`}
              to={href}
              onClick={() => triggerHaptic('light')}
              className="flex-none snap-start text-left"
            >
              {cardInner}
            </PrefetchLink>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Ranked Pulse Chart ("Trending"):
 * Monospace ranked chart pages (01..05, 06..10...) swipeable by pages of 5.
 */
function PulseChartShelf({ shelf, index }: { shelf: Shelf; index: string }) {
  const playingId = usePlayer((s) => s.nowPlaying?.videoId ?? null);
  const status = usePlayer((s) => s.status);
  const isPlaying = status === 'playing' || status === 'buffering';

  const pages: MusicItem[][] = [];
  for (let i = 0; i < shelf.items.length; i += 5) {
    pages.push(shelf.items.slice(i, i + 5));
  }
  if (!pages.length) return null;

  return (
    <section aria-label={shelf.title} className="pb-6">
      <CrateHeader
        index={index}
        title={shelf.title}
        to={shelf.seeAll ? browseHref(shelf.seeAll) : null}
        badge="PULSE CHART"
      />
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
        {pages.map((chunk, pIdx) => (
          <div
            key={pIdx}
            className="acoustic-glass flex w-[89vw] max-w-[410px] flex-none snap-start flex-col divide-y divide-white/[0.06] rounded-[22px] p-2"
          >
            {chunk.map((item, rIdx) => {
              const rank = pIdx * 5 + rIdx + 1;
              const artist = item.artists.map((a) => a.name).filter(Boolean).join(', ') || item.subtitle;
              const title = cleanTrackTitle(item.title, artist);
              const active = playingId === item.id;
              const isTop3 = rank <= 3;

              return (
                <button
                  key={`${item.id}-${rank}`}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    playTrack(item);
                  }}
                  className="tactile-press flex w-full items-center gap-3 rounded-[14px] px-2.5 py-2 text-left hover:bg-white/[0.06]"
                  style={active ? { backgroundColor: 'rgba(var(--accent-rgb), 0.14)' } : undefined}
                >
                  <span
                    className="w-6 flex-none font-mono text-[13px] font-bold tabular-nums"
                    style={{
                      color: active || isTop3 ? 'var(--accent-bright)' : 'var(--systemTertiary)',
                    }}
                  >
                    {pad2(rank)}
                  </span>

                  <div className="size-11 flex-none overflow-hidden rounded-[10px] bg-white/[0.05] ring-1 ring-white/10">
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

                  {active && isPlaying && (
                    <span className="inline-flex h-3.5 items-end gap-[2px]" aria-label="Playing">
                      {[0, 150, 300].map((d, k) => (
                        <span
                          key={k}
                          className="w-[2.5px] animate-sonic-eq rounded-full"
                          style={{ height: '100%', backgroundColor: 'var(--accent-bright)', animationDelay: `${d}ms` }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Cinema-style 16:9 Music Video Shelf with frosted HD · VIDEO glass badges. */
function CinemaVideoShelf({ shelf, index }: { shelf: Shelf; index: string }) {
  if (!shelf.items.length) return null;
  return (
    <section aria-label={shelf.title} className="pb-6">
      <CrateHeader
        index={index}
        title={shelf.title}
        to={shelf.seeAll ? browseHref(shelf.seeAll) : null}
        badge="CINEMA REELS"
      />
      <div className="no-scrollbar flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4">
        {shelf.items.map((item, i) => {
          const artist = item.artists.map((a) => a.name).filter(Boolean).join(', ') || item.subtitle;
          const title = cleanTrackTitle(item.title, artist);
          return (
            <button
              key={`${item.id}-${i}`}
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                playTrack(item);
              }}
              className="acoustic-glass group flex w-[78vw] max-w-[310px] flex-none snap-start flex-col overflow-hidden rounded-[20px] p-2 text-left transition-transform active:scale-[0.97]"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-[13px] bg-[#101624] ring-1 ring-white/10">
                {item.thumbnail && (
                  <img
                    src={sizedArtwork(item.thumbnail, 480)}
                    alt={title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(7,9,15,0.65),transparent_55%)]" />
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#07090f]/75 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur-md">
                  <Film size={9} style={{ color: 'var(--accent-bright)' }} />
                  <span>VIDEO</span>
                </span>
                <span className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md">
                  <Play size={13} fill="currentColor" className="translate-x-[1px]" />
                </span>
              </div>

              <div className="mt-2.5 flex flex-col gap-0.5 px-1 pb-0.5">
                <span className="truncate text-[14px] font-bold text-primary">{title}</span>
                <span className="truncate text-[12px] text-secondary">{artist}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * EXPLORE SCREEN ("The Discovery Crate"):
 * Spotlight Releases Carousel -> Ranked Pulse Chart -> Cinema 16:9 Music Videos.
 */
export default function NewPage() {
  const { missing } = useYouTubeReady();
  const explore = useExplore();

  if (missing) return <NeedsExtension />;
  if (explore.isError) return <LoadError error={explore.error} onRetry={() => void explore.refetch()} />;
  if (!explore.data) return <NewSkeleton />;

  return (
    <div className="flex flex-col pt-2">
      {explore.data.map((shelf, idx) => {
        const num = pad2(idx + 1);
        const lower = shelf.title.toLowerCase();
        if (shelf.layout === 'video' || lower.includes('video')) {
          return <CinemaVideoShelf key={`${shelf.title}-${idx}`} shelf={shelf} index={num} />;
        }
        if (shelf.layout === 'tracks' || lower.includes('trending') || lower.includes('chart')) {
          return <PulseChartShelf key={`${shelf.title}-${idx}`} shelf={shelf} index={num} />;
        }
        return <SpotlightCarousel key={`${shelf.title}-${idx}`} shelf={shelf} index={num} />;
      })}
    </div>
  );
}
