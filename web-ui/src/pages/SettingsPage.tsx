import { Activity, Sparkles, Vibrate, Waves } from 'lucide-react';
import { AUTOMIX_BARS } from '@/playback/automix/choices';
import { triggerHaptic } from '@/lib/haptics';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';
import { YouTubeIntegration } from './YouTubeIntegration';

type CrossfadeStep = { id: number | 'automix'; label: string; overlapRatio: number };

const CROSSFADE_STEPS: CrossfadeStep[] = [
  { id: 0, label: 'Off', overlapRatio: 0 },
  { id: 2, label: '2s', overlapRatio: 0.24 },
  { id: 5, label: '5s', overlapRatio: 0.48 },
  { id: 8, label: '8s', overlapRatio: 0.72 },
  { id: 12, label: '12s', overlapRatio: 0.94 },
  { id: 'automix', label: 'Auto', overlapRatio: 0.84 },
];

/** Clean tactile switch with dynamic accent glow & haptic feedback. */
function HardwareSwitch({
  icon,
  label,
  detail,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => {
        triggerHaptic('medium');
        onChange(!checked);
      }}
      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="grid size-9 flex-none place-items-center rounded-[12px] border border-white/[0.09] bg-white/[0.04]"
          style={
            checked
              ? { color: 'var(--accent-bright)', borderColor: 'rgba(var(--accent-rgb), 0.35)' }
              : { color: 'var(--systemSecondary)' }
          }
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[14px] font-semibold text-primary">{label}</span>
          <span className="mt-0.5 text-[12px] leading-snug text-secondary">{detail}</span>
        </div>
      </div>

      <span
        aria-hidden="true"
        className="relative inline-flex h-7 w-12 flex-none items-center rounded-full border p-0.5 transition-all duration-200"
        style={
          checked
            ? {
                backgroundColor: 'rgba(var(--accent-rgb), 0.85)',
                borderColor: 'rgba(var(--accent-rgb), 0.95)',
                boxShadow: '0 0 14px rgba(var(--accent-rgb), 0.42)',
              }
            : {
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.12)',
              }
        }
      >
        <span
          className={`size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.45)] transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
}

/** Clean interactive SVG crossfade curve preview (jargon-free). */
function CrossfadeCurveGraphic({ overlapRatio }: { overlapRatio: number }) {
  const halfSpan = overlapRatio * 74;
  const outStart = 140 - halfSpan;
  const outEnd = 140 + halfSpan;

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-white/[0.07] bg-[#060911]/85 px-3 py-2">
      <svg viewBox="0 0 280 50" className="h-[50px] w-full" aria-hidden="true">
        <line x1="0" y1="25" x2="280" y2="25" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 4" />
        <line x1="140" y1="4" x2="140" y2="46" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />

        {overlapRatio === 0 ? (
          <>
            <path d="M 8 13 L 136 13 L 136 44" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeLinecap="round" />
            <path d="M 144 44 L 144 13 L 272 13" fill="none" stroke="var(--accent-bright)" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect
              x={outStart}
              y="7"
              width={Math.max(4, outEnd - outStart)}
              height="37"
              rx="4"
              fill="rgba(var(--accent-rgb), 0.14)"
            />
            <path
              d={`M 8 13 L ${outStart} 13 C ${outStart + halfSpan * 0.7} 13, ${outEnd - halfSpan * 0.7} 44, ${outEnd} 44`}
              fill="none"
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={`M ${outStart} 44 C ${outStart + halfSpan * 0.7} 44, ${outEnd - halfSpan * 0.7} 13, ${outEnd} 13 L 272 13`}
              fill="none"
              stroke="var(--accent-bright)"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="140" cy="28.5" r="3.5" fill="var(--accent-bright)" />
            <circle cx="140" cy="28.5" r="7" fill="rgba(var(--accent-rgb), 0.35)" />
          </>
        )}
      </svg>
    </div>
  );
}

/**
 * SETTINGS SCREEN:
 * Clean, calm Acoustic Glass layout:
 * - Account (YouTube Music connection)
 * - Audio (Cosmetic HI-RES · 24-bit · 192 kHz readout when playing, Ready when idle)
 * - Playback (AutoPlay, Show Stats, Crossfade curve & stepped rail)
 * - Appearance (Dynamic Ambient Glow, Haptic Feedback)
 */
export default function SettingsPage() {
  const autoplay = usePlayer((s) => s.autoplay);
  const crossfadeSec = usePlayer((s) => s.crossfadeSec);
  const automix = usePlayer((s) => s.automix);
  const automixBars = usePlayer((s) => s.automixBars);
  const showNerdStats = usePlayer((s) => s.showNerdStats);
  const nowPlaying = usePlayer((s) => s.nowPlaying);
  const { setAutoplay, setCrossfade, setAutomix, setAutomixBars, setShowNerdStats } = usePlayer.getState();

  const dynamicAmbient = useUi((s) => s.dynamicAmbient);
  const setDynamicAmbient = useUi((s) => s.setDynamicAmbient);
  const hapticsEnabled = useUi((s) => s.hapticsEnabled);
  const setHapticsEnabled = useUi((s) => s.setHapticsEnabled);

  const activeCrossfadeId: number | 'automix' = automix ? 'automix' : crossfadeSec;
  const matchedStep =
    CROSSFADE_STEPS.find((s) => s.id === activeCrossfadeId) ??
    CROSSFADE_STEPS.reduce((best, curr) => {
      if (typeof curr.id !== 'number' || typeof activeCrossfadeId !== 'number') return best;
      if (typeof best.id !== 'number') return curr;
      return Math.abs(curr.id - activeCrossfadeId) < Math.abs(best.id - activeCrossfadeId) ? curr : best;
    }, CROSSFADE_STEPS[0]!);

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-5 px-4 pt-3 pb-4">
      {/* Account */}
      <section aria-label="Account" className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold text-secondary">Account</h2>
        <div className="acoustic-glass overflow-hidden rounded-[20px]">
          <YouTubeIntegration />
        </div>
      </section>

      {/* Audio Quality (Cosmetic HI-RES Display) */}
      <section aria-label="Audio" className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold text-secondary">Audio</h2>
        <div className="acoustic-glass overflow-hidden rounded-[20px] p-3">
          {nowPlaying ? (
            <div className="grid grid-cols-3 divide-x divide-white/[0.08] rounded-[14px] border border-white/[0.07] bg-[#060911]/85 py-3">
              <div className="flex flex-col items-center gap-0.5 px-2 text-center">
                <span className="font-mono text-[9.5px] font-medium tracking-[0.08em] text-tertiary uppercase">Quality</span>
                <span
                  className="font-mono text-[14px] font-bold tracking-[0.04em]"
                  style={{ color: 'var(--accent-bright)' }}
                >
                  HI-RES
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-2 text-center">
                <span className="font-mono text-[9.5px] font-medium tracking-[0.08em] text-tertiary uppercase">Depth</span>
                <span className="font-mono text-[14px] font-bold text-primary tabular-nums">24-bit</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 px-2 text-center">
                <span className="font-mono text-[9.5px] font-medium tracking-[0.08em] text-tertiary uppercase">Rate</span>
                <span className="font-mono text-[14px] font-bold text-primary tabular-nums">192 kHz</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-[14px] border border-white/[0.07] bg-[#060911]/75 px-4 py-3">
              <span className="text-[13.5px] font-medium text-secondary">Output Status</span>
              <span className="inline-flex items-center gap-2 font-mono text-[12px] font-semibold text-primary">
                <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.85)]" />
                <span>Ready</span>
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Playback */}
      <section aria-label="Playback" className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold text-secondary">Playback</h2>

        <div className="acoustic-glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
          <HardwareSwitch
            icon={<Waves size={16} />}
            label="AutoPlay"
            detail="Keep playing similar music when the queue ends"
            checked={autoplay}
            onChange={setAutoplay}
          />

          <HardwareSwitch
            icon={<Activity size={16} />}
            label="Show Stats"
            detail="Show Hi-Res audio badge on the player screen"
            checked={showNerdStats}
            onChange={setShowNerdStats}
          />

          {/* Crossfade */}
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold text-primary">Crossfade</span>
                <span className="text-[12px] text-secondary">Smooth transition between tracks</span>
              </div>
              <span
                className="rounded-full border border-white/[0.1] bg-white/[0.05] px-2.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums"
                style={{ color: 'var(--accent-bright)' }}
              >
                {automix ? 'Automix' : crossfadeSec === 0 ? 'Off' : `${crossfadeSec}s`}
              </span>
            </div>

            <CrossfadeCurveGraphic overlapRatio={matchedStep.overlapRatio} />

            <div className="grid grid-cols-6 gap-1 rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-1">
              {CROSSFADE_STEPS.map((step) => {
                const selected = matchedStep.id === step.id;
                return (
                  <button
                    key={String(step.id)}
                    type="button"
                    onClick={() => {
                      triggerHaptic('medium');
                      if (step.id === 'automix') setAutomix(true);
                      else setCrossfade(step.id);
                    }}
                    className={`rounded-[10px] py-1.5 font-mono text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                      selected ? 'text-white' : 'text-secondary hover:text-primary'
                    }`}
                    style={
                      selected
                        ? {
                            backgroundColor: 'var(--accent-hex)',
                            boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.38)',
                          }
                        : undefined
                    }
                  >
                    {step.label}
                  </button>
                );
              })}
            </div>

            {automix && (
              <div className="mt-1 flex flex-col gap-2 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-secondary">Blend Length</span>
                  <span className="font-mono text-[11px] font-semibold" style={{ color: 'var(--accent-bright)' }}>
                    Up to {automixBars} bars
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {AUTOMIX_BARS.map((bars) => {
                    const active = automixBars === bars;
                    return (
                      <button
                        key={bars}
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setAutomixBars(bars);
                        }}
                        className={`rounded-[10px] border py-1.5 font-mono text-[11px] font-semibold transition-all ${
                          active ? 'text-white' : 'border-white/[0.08] bg-white/[0.03] text-secondary'
                        }`}
                        style={
                          active
                            ? {
                                borderColor: 'rgba(var(--accent-rgb), 0.6)',
                                backgroundColor: 'rgba(var(--accent-rgb), 0.25)',
                              }
                            : undefined
                        }
                      >
                        {bars} bars
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section aria-label="Appearance" className="flex flex-col gap-2">
        <h2 className="px-1 text-[13px] font-semibold text-secondary">Appearance</h2>

        <div className="acoustic-glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
          <HardwareSwitch
            icon={<Sparkles size={16} />}
            label="Dynamic Ambient Glow"
            detail="Adapt ambient glow, waveform & accents to album artwork"
            checked={dynamicAmbient}
            onChange={setDynamicAmbient}
          />

          <HardwareSwitch
            icon={<Vibrate size={16} />}
            label="Haptic Feedback"
            detail="Subtle tactile vibrations on switches and controls"
            checked={hapticsEnabled}
            onChange={setHapticsEnabled}
          />
        </div>
      </section>
    </div>
  );
}
