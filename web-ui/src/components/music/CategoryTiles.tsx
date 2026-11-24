import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PrefetchLink } from '@/components/PrefetchLink';
import { firstBrowseArtwork } from '@/data/music/mappers';
import { browseQuery, useYouTubeReady } from '@/data/music/queries';
import { sizedArtwork } from '@/lib/artwork';
import { triggerHaptic } from '@/lib/haptics';
import type { Category, CategoryGroup } from '@/data/music/types';
import { browseHref } from './links';

function useNearViewport<T extends HTMLElement>(rootMargin = '500px') {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, rootMargin]);
  return { ref, near };
}

/** 4 bespoke minimal geometric acoustic SVG backdrops (zero visual clutter, zero text collision). */
function AcousticPattern({ variant }: { variant: number }) {
  const stroke = 'rgba(255,255,255,0.16)';
  switch (variant % 4) {
    case 0:
      // Concentric speaker / acoustic rings
      return (
        <svg viewBox="0 0 120 120" className="pointer-events-none absolute -top-5 -right-5 size-28 opacity-85" aria-hidden="true">
          <circle cx="72" cy="48" r="16" fill="none" stroke={stroke} strokeWidth="1" />
          <circle cx="72" cy="48" r="30" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="3 4" />
          <circle cx="72" cy="48" r="44" fill="none" stroke={stroke} strokeWidth="1" />
          <circle cx="72" cy="48" r="3.5" fill="rgba(255,255,255,0.28)" />
        </svg>
      );
    case 1:
      // Harmonic soundwave curves
      return (
        <svg viewBox="0 0 180 90" className="pointer-events-none absolute top-1 right-0 h-20 w-36 opacity-85" aria-hidden="true">
          <path d="M0 45 Q 25 14, 50 45 T 100 45 T 150 45 T 180 45" fill="none" stroke={stroke} strokeWidth="1.2" />
          <path d="M0 55 Q 30 24, 60 55 T 120 55 T 180 55" fill="none" stroke={stroke} strokeWidth="0.9" opacity="0.65" />
          <path d="M10 35 Q 35 8, 60 35 T 110 35 T 165 35" fill="none" stroke={stroke} strokeWidth="0.8" opacity="0.45" />
        </svg>
      );
    case 2:
      // Frequency analyzer bars
      return (
        <svg viewBox="0 0 120 72" className="pointer-events-none absolute top-3 right-3 h-14 w-24 opacity-75" aria-hidden="true">
          {[18, 34, 24, 48, 30, 56, 40, 26, 44, 20].map((h, i) => (
            <rect
              key={i}
              x={i * 11 + 4}
              y={64 - h}
              width="4.5"
              height={h}
              rx="2.25"
              fill="rgba(255,255,255,0.16)"
            />
          ))}
        </svg>
      );
    default:
      // Studio diagonal phase grid
      return (
        <svg viewBox="0 0 140 90" className="pointer-events-none absolute top-0 right-0 h-24 w-32 opacity-80" aria-hidden="true">
          <path d="M25 0 L140 85 M55 0 L140 62 M85 0 L140 40 M0 10 L115 90" stroke={stroke} strokeWidth="1" />
          <circle cx="96" cy="30" r="14" fill="none" stroke={stroke} strokeWidth="1" />
        </svg>
      );
  }
}

/**
 * Custom Acoustic Mood Tile:
 * NEVER exposes raw text-heavy YouTube thumbnails. Instead applies heavy artistic blur(28px) saturate(1.45)
 * purely as an atmospheric color wash, layered with geometric acoustic SVG art & crisp bottom-left typography.
 */
function CategoryTile({ category, index }: { category: Category; index: number }) {
  const { ready } = useYouTubeReady();
  const { ref, near } = useNearViewport<HTMLLIElement>();
  const [loaded, setLoaded] = useState(false);
  const browse = useQuery({ ...browseQuery(category.link), enabled: ready && near });
  const borrowed = browse.data ? firstBrowseArtwork(browse.data) : null;
  const artwork = borrowed ? sizedArtwork(borrowed.thumbnail, 160) : null;

  return (
    <li
      ref={ref}
      className="animate-card-in"
      style={{ animationDelay: `${Math.min((index % 12) * 28, 220)}ms` }}
    >
      <PrefetchLink
        to={browseHref(category.link)}
        onClick={() => triggerHaptic('light')}
        className="tactile-press group relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-[18px] border border-white/[0.12] px-3.5 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_rgba(0,0,0,0.45)]"
        style={
          {
            '--tile-color': category.color,
            background:
              'radial-gradient(125% 110% at 100% 0%, color-mix(in srgb, var(--tile-color) 62%, #182038) 0%, color-mix(in srgb, var(--tile-color) 24%, #0a0e19) 62%, #07090f 100%)',
          } as React.CSSProperties
        }
      >
        {/* Heavy artistic color wash extracted purely from source image (0% legible raw text collision) */}
        {artwork && (
          <img
            src={artwork}
            alt=""
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setLoaded(true)}
            className="pointer-events-none absolute inset-0 size-full scale-150 object-cover blur-[28px] saturate-[1.45] transition-opacity duration-500"
            style={{ opacity: loaded ? 0.52 : 0 }}
          />
        )}

        {/* Moody obsidian vignette to guarantee high-contrast text legibility */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,rgba(7,9,15,0.14)_0%,rgba(7,9,15,0.68)_100%)]"
        />

        {/* Bespoke Geometric Acoustic Pattern */}
        <AcousticPattern variant={index} />

        {/* Clean Bottom-Left Category Title */}
        <span className="relative z-1 mt-auto line-clamp-2 text-[14.5px] font-bold leading-snug tracking-[-0.01em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
          {category.title}
        </span>
      </PrefetchLink>
    </li>
  );
}

/** Moods, moments, and genre discovery tiles rendered as art-directed Acoustic Mood Tiles. */
export function CategoryTiles({ groups }: { groups: CategoryGroup[] }) {
  return (
    <div className="flex flex-col gap-6 pt-3 pb-4">
      {groups.map((group, gIdx) => (
        <section key={`${group.title}-${gIdx}`} aria-label={group.title} className="px-4">
          <h2 className="mb-3 text-[18px] font-bold tracking-[-0.02em] text-primary">{group.title}</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {group.categories.map((category, cIdx) => (
              <CategoryTile key={category.title} category={category} index={gIdx * 12 + cIdx} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
