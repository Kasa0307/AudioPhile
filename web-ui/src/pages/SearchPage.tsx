import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { PrefetchLink } from '@/components/PrefetchLink';
import { SkeletonBlock, SkeletonLine } from '@/components/Skeleton';
import { Artwork } from '@/components/music/Artwork';
import { CategoryTiles } from '@/components/music/CategoryTiles';
import { hrefFor } from '@/components/music/links';
import { playTrack, toTrack } from '@/components/music/play';
import { SearchField } from '@/components/music/SearchField';
import { Shelves } from '@/components/music/ShelfView';
import { EmptyState, LoadError, NeedsExtension } from '@/components/music/States';
import { TrackMenu } from '@/components/music/TrackMenu';
import { useCategories, useSearch, useYouTubeReady } from '@/data/music/queries';
import type { MusicItem, SearchResults, Shelf } from '@/data/music/types';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { ShelfSkeleton } from '@/skeletons/ShelfSkeleton';

type SearchFilter = 'all' | 'songs' | 'albums' | 'artists' | 'playlists' | 'videos';

const FILTERS: { id: SearchFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'songs', label: 'Tracks' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'videos', label: 'Videos' },
];

const KIND_LABEL: Record<MusicItem['kind'], string> = {
  song: 'TRACK',
  video: 'VIDEO',
  album: 'ALBUM',
  playlist: 'PLAYLIST',
  'spotify-playlist': 'PLAYLIST',
  artist: 'ARTIST',
  episode: 'EPISODE',
  podcast: 'PODCAST',
  unknown: '',
};

function shelvesFor(results: SearchResults, filter: SearchFilter): Shelf[] {
  const shelf = (title: string, items: MusicItem[], layout: Shelf['layout']): Shelf | null =>
    items.length ? { title, strapline: null, layout, items, seeAll: null } : null;

  const all: (Shelf | null)[] = [];
  if (filter === 'all' || filter === 'songs') all.push(shelf('Tracks', results.songs, 'tracks'));
  if (filter === 'all' || filter === 'artists') all.push(shelf('Artists', results.artists, 'circle'));
  if (filter === 'all' || filter === 'albums') all.push(shelf('Albums', results.albums, 'square'));
  if (filter === 'all' || filter === 'playlists') all.push(shelf('Playlists', results.playlists, 'square'));
  if (filter === 'all' || filter === 'videos') all.push(shelf('Videos', results.videos, 'video'));

  return all.filter((s): s is Shelf => !!s);
}

function TopResult({ item }: { item: MusicItem }) {
  const href = hrefFor(item);
  const playable = item.kind === 'song' || item.kind === 'video';
  const artistLine = item.artists.map((a) => a.name).join(', ');
  const title = cleanTrackTitle(item.title, artistLine);

  const body = (
    <>
      <div className="w-[68px] flex-none">
        <Artwork
          src={item.thumbnail}
          displayWidth={68}
          radius={item.kind === 'artist' ? '50%' : '12px'}
        />
      </div>
      <div className={playable ? 'flex min-w-0 flex-1 flex-col gap-0.5 pr-8' : 'flex min-w-0 flex-1 flex-col gap-0.5'}>
        <span className="font-mono text-[9.5px] font-semibold tracking-[0.12em] uppercase" style={{ color: 'var(--accent-bright)' }}>
          {KIND_LABEL[item.kind] || 'MATCH'}
        </span>
        <span className="line-clamp-1 text-[15px] font-bold text-primary">{title}</span>
        {item.kind !== 'artist' && artistLine && (
          <span className="truncate text-[12.5px] text-secondary">{artistLine}</span>
        )}
      </div>
    </>
  );

  return (
    <div className="acoustic-glass group/top relative rounded-[18px] transition-colors hover:bg-white/[0.08]">
      {href ? (
        <PrefetchLink
          to={href}
          onClick={() => triggerHaptic('light')}
          className="flex w-full items-center gap-3.5 p-2.5 text-left"
        >
          {body}
        </PrefetchLink>
      ) : (
        <button
          type="button"
          className="flex w-full items-center gap-3.5 p-2.5 text-left"
          onClick={() => {
            triggerHaptic('light');
            playTrack(item);
          }}
        >
          {body}
        </button>
      )}
      {playable && (
        <TrackMenu
          track={toTrack(item)}
          className="absolute right-2.5 bottom-2.5 z-3 grid size-7 place-items-center rounded-full text-secondary hover:bg-white/[0.1] hover:text-primary"
        />
      )}
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-busy="true" className="px-4 pt-3">
      <div className="mb-3">
        <SkeletonLine lineHeight={20} fontSize={16} width={120} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="acoustic-glass flex items-center gap-3 rounded-[18px] p-2.5">
            <SkeletonBlock width={68} height={68} radius="12px" />
            <div className="flex flex-1 flex-col gap-1.5">
              <SkeletonLine lineHeight={16} fontSize={14} width="70%" />
              <SkeletonLine lineHeight={14} fontSize={12} width="45%" />
            </div>
          </div>
        ))}
      </div>
      <ShelfSkeleton kind="square" />
    </div>
  );
}

function Results({ query, filter }: { query: string; filter: SearchFilter }) {
  const search = useSearch(query);
  if (search.isError) return <LoadError error={search.error} onRetry={() => void search.refetch()} />;
  if (!search.data) return <ResultsSkeleton />;

  const results = search.data;
  const shelves = shelvesFor(results, filter);
  const showTop = filter === 'all' && results.top.length > 0;

  if (!showTop && !shelves.length) {
    return <EmptyState title="No Matches" detail={`Nothing found under this filter for “${query}”.`} />;
  }

  return (
    <div className="pt-2">
      {showTop && (
        <section aria-label="Top Results" className="mb-6 px-4">
          <h2 className="mb-3 text-[18px] font-bold tracking-[-0.02em] text-primary">Top Results</h2>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {results.top.slice(0, 6).map((item) => (
              <TopResult key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}
      <Shelves shelves={shelves} />
    </div>
  );
}

function Landing() {
  const categories = useCategories();
  if (categories.isError) return <LoadError error={categories.error} onRetry={() => void categories.refetch()} />;
  if (!categories.data) {
    return (
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true">
        {Array.from({ length: 10 }, (_, i) => (
          <SkeletonBlock key={i} aspectRatio="16 / 10" radius="18px" />
        ))}
      </div>
    );
  }
  return <CategoryTiles groups={categories.data.map((g) => ({ ...g, title: g.title || 'Moods & Moments' }))} />;
}

/**
 * SEARCH SCREEN ("Acoustic Discovery"):
 * Elevated Floating Search Lens + instant category filter chips + Custom Acoustic Mood Tiles
 * with zero raw thumbnail text collisions.
 */
export default function SearchPage() {
  const { missing } = useYouTubeReady();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<SearchFilter>('all');

  const showFilterChips = focused || query.trim().length > 0;

  return (
    <div className="flex flex-col">
      {/* Floating Search Lens + Filter Chips */}
      <div className="sticky top-0 z-[calc(var(--z-default)+5)] flex flex-col items-center gap-2.5 px-4 pt-2 pb-3 before:absolute before:inset-0 before:-z-1 before:bg-[#07090f]/82 before:backdrop-blur-xl">
        <SearchField
          initial={query}
          onFocusChange={setFocused}
          onSearch={(q) => {
            setFilter('all');
            setParams(q ? { q } : {});
          }}
        />

        {showFilterChips && (
          <div className="no-scrollbar flex w-full max-w-[540px] items-center gap-1.5 overflow-x-auto pb-0.5">
            {FILTERS.map(({ id, label }) => {
              const active = filter === id;
              return (
                <button
                  key={id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    triggerHaptic('light');
                    setFilter(id);
                  }}
                  className={`flex-none rounded-full border px-3 py-1 font-mono text-[10.5px] font-semibold tracking-[0.06em] uppercase transition-all ${
                    active ? 'text-white' : 'border-white/[0.09] bg-white/[0.04] text-secondary hover:text-primary'
                  }`}
                  style={
                    active
                      ? {
                          backgroundColor: 'rgba(var(--accent-rgb), 0.88)',
                          borderColor: 'rgba(var(--accent-rgb), 0.9)',
                          boxShadow: '0 4px 14px rgba(var(--accent-rgb), 0.35)',
                        }
                      : undefined
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {missing ? (
        <NeedsExtension what="and search YouTube Music" />
      ) : query ? (
        <Results query={query} filter={filter} />
      ) : (
        <Landing />
      )}
    </div>
  );
}
