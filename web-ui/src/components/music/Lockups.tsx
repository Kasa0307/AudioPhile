import { Check } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';
import { PlayIcon } from '@/components/icons/Transport';
import type { MusicItem } from '@/data/music/types';
import { useBatchSelect } from '@/state/batchSelect';
import { Artwork } from './Artwork';
import { ExplicitBadge } from './ExplicitBadge';
import { artistHref, hrefFor } from './links';
import { playTrack, toTrack } from './play';
import { TrackMenu } from './TrackMenu';

const isPlayable = (item: MusicItem) => item.kind === 'song' || item.kind === 'video';

/* Lockups (report §2). */
const lockup = 'flex min-w-0 flex-col';
const caption = 'mt-2 flex min-w-0 flex-col gap-px';
const title = 'flex min-w-0 items-center type-callout [&>:first-child]:truncate';
const subtitle = 'truncate type-callout text-secondary';
const overlayLink = 'absolute inset-0 z-1 rounded-[inherit]';

/** Artist names as links where YouTube links them, else the given subtitle. */
function Byline({ item }: { item: MusicItem }) {
  const linked = item.artists.some((a) => a.id);
  if (!linked || item.kind === 'album' || item.kind === 'playlist') return <>{item.subtitle}</>;
  return (
    <>
      {item.artists.map((artist, i) => {
        const href = artistHref(artist.id);
        return (
          <span key={`${artist.name}-${i}`}>
            {i > 0 && ', '}
            {href ? (
              <PrefetchLink to={href} className="hover:underline">
                {artist.name}
              </PrefetchLink>
            ) : (
              artist.name
            )}
          </span>
        );
      })}
    </>
  );
}

function PlayPlatter({ item }: { item: MusicItem }) {
  return (
    <button
      className="pointer-events-auto absolute bottom-2.5 left-2.5 grid size-[30px] place-items-center rounded-full bg-thin-material text-white [backdrop-filter:saturate(180%)_blur(60px)] hover:bg-key-bg"
      aria-label={`Play ${item.title}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        playTrack(item);
      }}
    >
      <PlayIcon size={16} />
    </button>
  );
}

/** The artwork with its hover scrim, linking to the item or playing it. */
function LockupArtwork({ item, width, aspect }: { item: MusicItem; width: number; aspect: number }) {
  const href = hrefFor(item);
  return (
    <div className="group/art relative rounded-artwork-md">
      <Artwork src={item.thumbnail} displayWidth={width} aspect={aspect} radius="var(--radius-artwork-medium)" />
      {href ? (
        <PrefetchLink to={href} className={overlayLink} aria-label={item.title} />
      ) : (
        <button className={overlayLink} aria-label={`Play ${item.title}`} onClick={() => playTrack(item)} />
      )}
      {/* Hover scrim and platter (report §2: --lockupHoverBGColor, opacity .1s ease-in). */}
      <div className="pointer-events-none absolute inset-0 z-2 rounded-[inherit] bg-lockup-hover opacity-0 transition-opacity duration-100 ease-in group-focus-visible/art:opacity-100 group-hover/art:opacity-100">{isPlayable(item) && <PlayPlatter item={item} />}</div>
      {/* The track menu (report §14) for playable items: top-right, the
          platter's counterpart in the same glass, revealed with the scrim
          and held visible while its menu is open. */}
      {isPlayable(item) && (
        <TrackMenu
          track={toTrack(item)}
          className="absolute top-2 right-2 z-3 grid size-7 place-items-center rounded-full bg-thin-material text-white opacity-0 transition-opacity duration-100 ease-in [backdrop-filter:saturate(180%)_blur(60px)] group-hover/art:opacity-100 focus-visible:opacity-100 hover:bg-key-bg data-open:opacity-100"
        />
      )}
    </div>
  );
}

/** Square lockup (report §2): artwork, hover scrim with play platter, title and subtitle. */
export function SquareLockup({ item, width = 220 }: { item: MusicItem; width?: number }) {
  const href = hrefFor(item);
  return (
    <div className={lockup}>
      <LockupArtwork item={item} width={width} aspect={1} />
      <div className={caption}>
        <div className={title}>
          {href ? (
            <PrefetchLink to={href} className="hover:underline">
              {item.title}
            </PrefetchLink>
          ) : (
            <span>{item.title}</span>
          )}
          {item.explicit && <ExplicitBadge />}
        </div>
        <div className={subtitle}>
          <Byline item={item} />
        </div>
      </div>
    </div>
  );
}

/** 16:9 video lockup (report §2, type C). */
export function VideoLockup({ item, width = 300 }: { item: MusicItem; width?: number }) {
  return (
    <div className={lockup}>
      <LockupArtwork item={item} width={width} aspect={16 / 9} />
      <div className={caption}>
        <div className={title}>
          <span>{item.title}</span>
          {item.explicit && <ExplicitBadge />}
        </div>
        <div className={subtitle}>{item.subtitle}</div>
      </div>
    </div>
  );
}

/** Circular artist lockup (report §2, type H). */
export function CircleLockup({ item, width = 160 }: { item: MusicItem; width?: number }) {
  return (
    <PrefetchLink to={hrefFor(item) ?? '#'} className="group/circle flex min-w-0 flex-col items-center gap-2.5">
      <Artwork src={item.thumbnail} displayWidth={width} radius="50%" />
      <span className="max-w-full truncate text-center type-body group-hover/circle:underline">{item.title}</span>
    </PrefetchLink>
  );
}

/** A song row inside a shelf (report §2, track lockup): 40px art, title, byline. */
export function TrackLockup({ item, onPlay }: { item: MusicItem; onPlay?: () => void }) {
  const selecting = useBatchSelect((s) => s.selecting);
  const selected = useBatchSelect((s) => s.selectedTracks.some((t) => t.videoId === item.id));
  const toggleTrack = useBatchSelect((s) => s.toggleTrack);
  const playable = isPlayable(item);
  const handleTap = () => {
    if (selecting && playable) {
      toggleTrack(toTrack(item));
      return;
    }
    if (onPlay) onPlay();
    else playTrack(item);
  };

  return (
    <div
      className="group/track grid h-[55px] grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-[12px] py-[7.5px] pr-2.5 pl-1 transition-colors"
      style={selecting && selected ? { backgroundColor: 'rgba(var(--accent-rgb), 0.14)' } : undefined}
    >
      <button className="group/art relative w-10 rounded-artwork-sm" aria-label={selecting ? `Select ${item.title}` : `Play ${item.title}`} onClick={handleTap}>
        <Artwork src={item.thumbnail} displayWidth={40} radius="var(--radius-artwork-small)" />
        {!selecting && (
          <span
            className="absolute inset-0 grid place-items-center rounded-[inherit] bg-lockup-hover text-white opacity-0 transition-opacity duration-100 ease-in group-hover/track:opacity-100 group-focus-visible/art:opacity-100"
            aria-hidden="true"
          >
            <PlayIcon size={16} />
          </span>
        )}
      </button>
      <div className="flex min-w-0 flex-col gap-px px-1">
        <div className="flex min-w-0 items-center type-body">
          <button className="min-w-0 truncate text-left" onClick={handleTap}>
            {item.title}
          </button>
          {item.explicit && <ExplicitBadge />}
        </div>
        <div className="truncate type-callout text-secondary">
          <Byline item={item} />
        </div>
      </div>
      {playable &&
        (selecting ? (
          <button
            type="button"
            onClick={handleTap}
            aria-label={selected ? `Deselect ${item.title}` : `Select ${item.title}`}
            className="grid size-6 place-items-center rounded-full border transition-all"
            style={
              selected
                ? {
                    borderColor: 'var(--accent-hex)',
                    backgroundColor: 'var(--accent-hex)',
                    boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.45)',
                  }
                : { borderColor: 'rgba(255,255,255,0.28)' }
            }
          >
            {selected && <Check size={13} strokeWidth={3} className="text-white" />}
          </button>
        ) : (
          <TrackMenu
            track={toTrack(item)}
            className="grid size-8 place-items-center rounded-full text-secondary opacity-80 transition-opacity duration-100 ease-in hover:bg-white/[0.08] hover:text-primary hover:opacity-100 data-open:opacity-100"
          />
        ))}
    </div>
  );
}
