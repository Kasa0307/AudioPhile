import { ListMusic, Mic2 } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { triggerHaptic } from '@/lib/haptics';
import { useUi } from '@/state/ui';
import { UpNext } from './UpNext';

// am-lyrics is large; it loads the first time the panel opens (prompt §3).
const LyricsPanel = lazy(() => import('./LyricsPanel').then((m) => ({ default: m.LyricsPanel })));

/**
 * Lower Deck of the Now Playing Console:
 * Acoustic Glass segmented switcher for Synced Lyrics & Up Next Queue
 * harmonized with the track's dynamic accent color.
 */
export function SidePanel() {
  const panel = useUi((s) => s.sidePanel);
  const fullScreen = useUi((s) => s.fullScreen);
  const activeTab = panel === 'up-next' ? 'up-next' : 'lyrics';

  return (
    <section
      className="relative flex min-h-0 flex-1 flex-col bg-[#070a13]/55 backdrop-blur-xl"
      aria-label={activeTab === 'up-next' ? 'Up Next Queue' : 'Lyrics'}
    >
      <div className="flex flex-none px-4 py-2.5">
        <div className="grid w-full grid-cols-2 gap-1 rounded-full border border-white/[0.09] bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              useUi.setState({ sidePanel: 'lyrics' });
            }}
            aria-pressed={activeTab === 'lyrics'}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-mono text-[10.5px] font-semibold tracking-[0.09em] uppercase transition-all duration-200 ${
              activeTab === 'lyrics' ? 'text-white' : 'text-secondary hover:text-primary'
            }`}
            style={
              activeTab === 'lyrics'
                ? {
                    backgroundColor: 'rgba(var(--accent-rgb), 0.85)',
                    boxShadow: '0 4px 16px rgba(var(--accent-rgb), 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }
                : undefined
            }
          >
            <Mic2 size={12} />
            <span>Lyrics</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              useUi.setState({ sidePanel: 'up-next' });
            }}
            aria-pressed={activeTab === 'up-next'}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 font-mono text-[10.5px] font-semibold tracking-[0.09em] uppercase transition-all duration-200 ${
              activeTab === 'up-next' ? 'text-white' : 'text-secondary hover:text-primary'
            }`}
            style={
              activeTab === 'up-next'
                ? {
                    backgroundColor: 'rgba(var(--accent-rgb), 0.85)',
                    boxShadow: '0 4px 16px rgba(var(--accent-rgb), 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }
                : undefined
            }
          >
            <ListMusic size={12} />
            <span>Up Next</span>
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {fullScreen ? (
          <div className="grid flex-1 place-items-center px-6 text-center">
            <span className="font-mono text-[11px] tracking-[0.1em] text-secondary uppercase">
              Active on Cinema Stage
            </span>
          </div>
        ) : activeTab === 'up-next' ? (
          <UpNext />
        ) : (
          <Suspense fallback={null}>
            <LyricsPanel />
          </Suspense>
        )}
      </div>
    </section>
  );
}
