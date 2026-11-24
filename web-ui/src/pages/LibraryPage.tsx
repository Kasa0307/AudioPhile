import { ChevronDown, ChevronUp, Heart, Music2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { PrefetchLink, PrefetchNavLink } from '@/components/PrefetchLink';
import { hrefFor } from '@/components/music/links';
import { playTrack } from '@/components/music/play';
import { EmptyState, LoadError, LoadMoreError, NeedsExtension } from '@/components/music/States';
import { TrackList } from '@/components/music/TrackList';
import { isLibrarySection, LIBRARY_SECTIONS, type LibrarySection } from '@/data/music/library';
import { mergeRecentTracks, useLocalRecentTracks } from '@/data/music/localHistory';
import { useLibrary, useSignedIn, useYouTubeReady } from '@/data/music/queries';
import type { MusicItem } from '@/data/music/types';
import { useYtAuth } from '@/extension/useYtAuth';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { PlainSkeleton } from '@/skeletons/PageSkeletons';

const TABS: { key: LibrarySection; label: string }[] = [
  { key: 'playlists', label: 'Playlists' },
  { key: 'songs', label: 'Songs' },
  { key: 'recent', label: 'Recent' },
  { key: 'artists', label: 'Artists' },
  { key: 'albums', label: 'Albums' },
];

/** Identifies non-music YouTube utility/video playlists so "Music Only" can cleanly group them at the bottom. */
function isNonMusicPlaylist(item: MusicItem): boolean {
  const t = item.title.trim().toLowerCase();
  const id = item.id.toUpperCase();
  return (
    t === 'liked videos' ||
    t === 'saved shorts' ||
    t === 'watch later' ||
    t.includes('shorts') ||
    id === 'VLLL' ||
    id === 'LL' ||
    id === 'WL' ||
    id === 'VLWL'
  );
}

function useLoadMore(onVisible: (() => void) | null) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = target.current;
    if (!node || !onVisible) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onVisible(), {
      rootMargin: '600px 0px',
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisible]);
  return target;
}

/**
 * Physical Collection Card with 2 subtle stacked sleeve layers peeking 3px & 6px above the artwork
 * to signify a multi-track vinyl/record collection.
 */
function VaultCollectionCard({ item }: { item: MusicItem }) {
  const href = hrefFor(item);
  const isArtist = item.kind === 'artist';
  const title = cleanTrackTitle(item.title, item.subtitle);
  const meta = item.subtitle || (item.kind === 'album' ? 'ALBUM' : item.kind === 'artist' ? 'ARTIST' : 'PLAYLIST');

  const content = isArtist ? (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="aspect-square w-full overflow-hidden rounded-full border border-white/[0.12] bg-[#121828] shadow-[0_12px_26px_rgba(0,0,0,0.45)]">
        {item.thumbnail && (
          <img
            src={sizedArtwork(item.thumbnail, 260)}
            alt={title}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="flex w-full flex-col gap-0.5 px-1">
        <span className="truncate text-[13.5px] font-semibold text-primary">{title}</span>
        <span className="font-mono text-[10px] tracking-[0.06em] text-tertiary uppercase">ARTIST</span>
      </div>
    </div>
  ) : (
    <div className="group flex flex-col">
      {/* Physical 2-layer stacked record sleeve header */}
      <div className="relative pt-2.5">
        <span
          aria-hidden="true"
          className="absolute inset-x-4 top-0 h-2.5 rounded-t-[10px] border-x border-t border-white/[0.08] bg-white/[0.03]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-x-2 top-[5px] h-2.5 rounded-t-[11px] border-x border-t border-white/[0.12] bg-white/[0.06]"
        />
        <div className="relative z-1 aspect-square w-full overflow-hidden rounded-[16px] border border-white/[0.12] bg-[#121828] shadow-[0_14px_30px_rgba(0,0,0,0.52)] transition-transform duration-200 group-active:scale-[0.96]">
          {item.thumbnail ? (
            <img
              src={sizedArtwork(item.thumbnail, 320)}
              alt={title}
              referrerPolicy="no-referrer"
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div
              className="relative grid size-full place-items-center overflow-hidden"
              style={{
                background:
                  'radial-gradient(circle at 50% 35%, rgba(var(--accent-rgb), 0.34) 0%, rgba(16, 22, 38, 0.92) 62%, #090d17 100%)',
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute size-20 rounded-full blur-2xl"
                style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.35)' }}
              />
              {title.toLowerCase().includes('liked') || item.id.toUpperCase().includes('LM') ? (
                <Heart
                  size={34}
                  strokeWidth={1.7}
                  className="relative z-1 drop-shadow-[0_0_16px_rgba(var(--accent-rgb),0.7)]"
                  style={{ color: 'var(--accent-bright)' }}
                  fill="rgba(var(--accent-rgb), 0.32)"
                />
              ) : (
                <Music2
                  size={34}
                  strokeWidth={1.7}
                  className="relative z-1 drop-shadow-[0_0_16px_rgba(var(--accent-rgb),0.7)]"
                  style={{ color: 'var(--accent-bright)' }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-col gap-0.5 px-0.5">
        <span className="truncate text-[13.5px] font-semibold leading-tight text-primary">{title}</span>
        <span className="truncate font-mono text-[10px] tracking-[0.04em] text-tertiary uppercase">{meta}</span>
      </div>
    </div>
  );

  return href ? (
    <PrefetchLink to={href} onClick={() => triggerHaptic('light')} className="block">
      {content}
    </PrefetchLink>
  ) : (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('light');
        playTrack(item);
      }}
      className="block w-full text-left"
    >
      {content}
    </button>
  );
}

/**
 * LIBRARY SCREEN ("The Record Vault"):
 * - Segmented Acoustic Glass Switcher (Playlists, Songs, Recent, Artists, Albums)
 * - Smart "Music Only" Cleanliness Toggle hiding non-music YouTube playlists into an expandable footer group
 * - Physical Layered Sleeve Stack cards with monospace metadata
 */
export default function LibraryPage() {
  const section = useParams().section ?? '';
  const { missing } = useYouTubeReady();
  const auth = useYtAuth();
  const signedIn = useSignedIn();
  const localRecent = useLocalRecentTracks();
  const library = useLibrary(isLibrarySection(section) ? section : 'playlists');
  const [musicOnly, setMusicOnly] = useState(true);
  const [showOtherPlaylists, setShowOtherPlaylists] = useState(false);

  const loadMore = useLoadMore(
    library.hasNextPage && !library.isFetchingNextPage && !library.isFetchNextPageError
      ? () => void library.fetchNextPage()
      : null,
  );

  if (!isLibrarySection(section)) return <Navigate to="/home" replace />;
  const title = LIBRARY_SECTIONS[section].title;
  if (missing) return <NeedsExtension what="your library" />;

  if (auth.state === 'ready' && !signedIn) {
    // Allow viewing local Recently Played even before signing in!
    if (section === 'recent' && localRecent.length > 0) {
      return (
        <div className="flex flex-col pt-2">
          <VaultSegmentedBar activeSection={section} />
          <div className="px-4 pt-3">
            <TrackList tracks={localRecent} variant="playlist" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col pt-2">
        <VaultSegmentedBar activeSection={section} />
        <EmptyState
          title="Connect Your Vault"
          detail="Sign in to YouTube Music in the top-right Audio Deck to sync your playlists, liked songs, and library."
        />
      </div>
    );
  }

  if (library.isError && !library.data) {
    return <LoadError error={library.error} onRetry={() => void library.refetch()} />;
  }
  if (!library.data) return <PlainSkeleton />;

  const rawGrid = library.data.pages.flatMap((page) => page.data.grid);
  const rawTracks = library.data.pages.flatMap((page) => page.data.tracks);
  const tracks = section === 'recent' ? mergeRecentTracks(localRecent, rawTracks, 200) : rawTracks;

  // Deduplicate grid items by id
  const seenGrid = new Set<string>();
  const uniqueGrid = rawGrid.filter((item) => {
    const key = `${item.kind}:${item.id}:${item.title}`;
    if (seenGrid.has(key)) return false;
    seenGrid.add(key);
    return true;
  });

  const isPlaylistsTab = section === 'playlists';
  const primaryGrid =
    isPlaylistsTab && musicOnly ? uniqueGrid.filter((item) => !isNonMusicPlaylist(item)) : uniqueGrid;
  const otherYouTubeGrid =
    isPlaylistsTab && musicOnly ? uniqueGrid.filter((item) => isNonMusicPlaylist(item)) : [];

  return (
    <div className="flex flex-col pt-1.5">
      <VaultSegmentedBar activeSection={section} />

      {/* Section Telemetry & Smart Cleanliness Filter */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <span className="font-mono text-[10.5px] font-semibold tracking-[0.12em] text-tertiary uppercase">
          {primaryGrid.length > 0
            ? `${primaryGrid.length} ${section === 'artists' ? 'ARTISTS' : section === 'albums' ? 'ALBUMS' : 'COLLECTIONS'}`
            : tracks.length > 0
              ? `${tracks.length} TRACKS`
              : title.toUpperCase()}
        </span>

        {isPlaylistsTab && uniqueGrid.length > 0 && (
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setMusicOnly((v) => !v);
            }}
            aria-pressed={musicOnly}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.06em] uppercase transition-all active:scale-95"
            style={
              musicOnly
                ? {
                    borderColor: 'rgba(var(--accent-rgb), 0.45)',
                    backgroundColor: 'rgba(var(--accent-rgb), 0.16)',
                    color: 'var(--accent-bright)',
                  }
                : {
                    borderColor: 'rgba(255,255,255,0.1)',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    color: 'var(--systemSecondary)',
                  }
            }
          >
            <Sparkles size={11} />
            <span>Music Only</span>
          </button>
        )}
      </div>

      {!primaryGrid.length && !otherYouTubeGrid.length && !tracks.length && (
        <EmptyState title="Nothing in the Vault" detail="Play or save music to build your collection." />
      )}

      {primaryGrid.length > 0 && (
        <ul
          key={`${section}-${musicOnly ? 'm' : 'a'}`}
          className="grid grid-cols-2 gap-x-3.5 gap-y-5 px-4 pt-1 sm:grid-cols-3 lg:grid-cols-4"
        >
          {primaryGrid.map((item, i) => (
            <li
              key={`${item.id}-${i}`}
              className="animate-card-in"
              style={{ animationDelay: `${Math.min(i * 24, 190)}ms` }}
            >
              <VaultCollectionCard item={item} />
            </li>
          ))}
        </ul>
      )}

      {/* Expandable Other YouTube Playlists (Liked videos, Saved Shorts, etc.) */}
      {otherYouTubeGrid.length > 0 && (
        <section className="mt-6 px-4">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setShowOtherPlaylists((v) => !v);
            }}
            className="acoustic-glass flex w-full items-center justify-between rounded-[16px] px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
          >
            <div className="flex flex-col">
              <span className="text-[13px] font-semibold text-primary">Other YouTube Playlists</span>
              <span className="font-mono text-[10px] tracking-[0.04em] text-tertiary">
                {otherYouTubeGrid.length} {otherYouTubeGrid.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            {showOtherPlaylists ? (
              <ChevronUp size={16} className="text-secondary" />
            ) : (
              <ChevronDown size={16} className="text-secondary" />
            )}
          </button>

          {showOtherPlaylists && (
            <ul className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {otherYouTubeGrid.map((item, i) => (
                <li key={`other-${item.id}-${i}`}>
                  <VaultCollectionCard item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tracks.length > 0 && (
        <div className="px-4 pt-1">
          <TrackList
            tracks={tracks}
            variant="playlist"
            source={section === 'recent' ? undefined : { title, type: 'library', id: section }}
            onNearEnd={
              library.hasNextPage && !library.isFetchingNextPage && !library.isFetchNextPageError
                ? () => void library.fetchNextPage()
                : undefined
            }
          />
        </div>
      )}

      {uniqueGrid.length > 0 && <div ref={loadMore} aria-hidden="true" />}
      {library.isFetchNextPageError && <LoadMoreError onRetry={() => void library.fetchNextPage()} />}
    </div>
  );
}

/** Sleek scrollable Acoustic Glass Segmented Switcher for Library sections. */
function VaultSegmentedBar({ activeSection }: { activeSection: LibrarySection }) {
  return (
    <div className="px-4">
      <nav
        aria-label="Library sections"
        className="acoustic-glass no-scrollbar flex items-center gap-1 overflow-x-auto rounded-[18px] p-1"
      >
        {TABS.map(({ key, label }) => {
          const active = activeSection === key;
          return (
            <PrefetchNavLink
              key={key}
              to={`/library/${key}`}
              onClick={() => triggerHaptic('light')}
              className={`flex-1 whitespace-nowrap rounded-[13px] px-3 py-1.5 text-center text-[12.5px] font-semibold transition-all duration-200 ${
                active ? 'text-white' : 'text-secondary hover:text-primary'
              }`}
              style={
                active
                  ? {
                      backgroundColor: 'rgba(var(--accent-rgb), 0.85)',
                      boxShadow: '0 4px 14px rgba(var(--accent-rgb), 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                    }
                  : undefined
              }
            >
              {label}
            </PrefetchNavLink>
          );
        })}
      </nav>
    </div>
  );
}
