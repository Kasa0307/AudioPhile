import { useMemo } from 'react';
import { usePlayer } from '@/state/player';
import { MixWindowHighlight } from './NerdStats';
import { useScrubber } from './useScrubber';

const BAR_COUNT = 48;

/**
 * Generates deterministic acoustic bar heights (`22..100`%) from a track's
 * videoId so each song renders a distinct studio waveform silhouette.
 */
export function buildWaveform(seed: string, count = BAR_COUNT): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    const raw = (hash >>> 0) / 0xffffffff;
    const pos = i / Math.max(1, count - 1);
    const envelope = 0.52 + 0.48 * Math.sin(pos * Math.PI);
    const wave = 0.65 + 0.35 * Math.sin(i * 0.85 + (hash & 7));
    const height = Math.round(22 + 78 * (0.45 * raw + 0.55 * wave) * envelope);
    bars.push(Math.min(100, Math.max(22, height)));
  }
  return bars;
}

/**
 * Dynamic Acoustic Waveform & Laser Playhead Scrubber:
 * Automatically adopts the currently playing album's extracted accent color
 * (--accent-hex / --accent-bright / --accent-rgb) for luminous played bars and playhead glow.
 */
export function WaveformScrubber({ variant = 'deck' }: { variant?: 'deck' | 'fullscreen' }) {
  const videoId = usePlayer((s) => s.nowPlaying?.videoId ?? 'audiophile-idle');
  const { bar, elapsed, remaining, mixLabel, dragging, handlers } = useScrubber();
  const bars = useMemo(() => buildWaveform(videoId), [videoId]);

  const capsuleClass =
    variant === 'fullscreen'
      ? 'group/scrub mt-4 rounded-[18px] border border-white/[0.11] bg-[#090d18]/65 px-4 pt-3.5 pb-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_12px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl'
      : 'group/scrub rounded-[16px] border border-white/[0.09] bg-[#0a0f1c]/62 px-3 pt-2.5 pb-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-xl';

  return (
    <div className={capsuleClass} data-dragging={dragging || undefined}>
      <div className="group/hit flex h-8 cursor-pointer touch-none items-center" {...handlers}>
        <div ref={bar} className="relative flex h-7 w-full items-center [--progress:0]">
          <MixWindowHighlight />

          {/* Unplayed base waveform silhouette */}
          <div className="flex size-full items-center gap-[2.5px]" aria-hidden="true">
            {bars.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-full bg-white/[0.14] transition-colors duration-150 group-hover/hit:bg-white/[0.22]"
              />
            ))}
          </div>

          {/* Played luminous dynamic-accent waveform clipped smoothly */}
          <div
            aria-hidden="true"
            style={{ clipPath: 'inset(0 calc((1 - var(--progress, 0)) * 100%) 0 0)' }}
            className="pointer-events-none absolute inset-0 flex items-center gap-[2.5px]"
          >
            {bars.map((h, i) => (
              <span
                key={i}
                style={{
                  height: `${h}%`,
                  background: 'linear-gradient(to top, var(--accent-hex), var(--accent-bright))',
                  boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.45)',
                }}
                className="flex-1 rounded-full transition-[background,box-shadow] duration-500"
              />
            ))}
          </div>

          {/* Luminous Dynamic Laser Playhead Needle */}
          <div
            aria-hidden="true"
            style={{
              left: 'calc(var(--progress, 0) * 100%)',
              boxShadow: '0 0 12px 2px rgba(var(--accent-rgb), 0.92)',
            }}
            className="pointer-events-none absolute top-[-3px] bottom-[-3px] w-[2px] -translate-x-1/2 rounded-full bg-white transition-[width] duration-150 group-hover/hit:w-[2.5px] group-data-dragging/scrub:w-[3px]"
          >
            <span
              className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full transition-transform duration-150 group-hover/hit:scale-125 group-data-dragging/scrub:scale-125"
              style={{
                backgroundColor: 'var(--accent-bright)',
                boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.95)',
              }}
            />
            <span
              className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full transition-transform duration-150 group-hover/hit:scale-125 group-data-dragging/scrub:scale-125"
              style={{
                backgroundColor: 'var(--accent-hex)',
                boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.95)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Monospace telemetry & timestamp pills */}
      <div className="relative mt-2 flex items-center justify-between gap-2">
        <span
          ref={elapsed}
          className="rounded-[6px] border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.04em] text-primary tabular-nums"
        >
          0:00
        </span>

        <span
          aria-hidden="true"
          className="flex items-center gap-1 text-[8px] tracking-[0.25em] text-white/20 select-none"
        >
          <span>|</span>
          <span>•</span>
          <span>|</span>
          <span>•</span>
          <span>|</span>
        </span>

        <span
          ref={mixLabel}
          className="pointer-events-none absolute inset-x-0 text-center font-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase opacity-0"
          style={{ color: 'var(--accent-bright)' }}
          aria-hidden="true"
        >
          Mixing
        </span>

        <span
          ref={remaining}
          className="rounded-[6px] border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.04em] text-secondary tabular-nums"
        >
          -0:00
        </span>
      </div>
    </div>
  );
}
